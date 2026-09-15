/**
 * Verification harness for the booking-confirmation notification.
 *
 * Exercises the flow without messaging a real customer: for the DB-backed
 * cases the gateway URL is pointed at a dead port, so only the retryable
 * claim/release path is hit. The live template smoke test is opt-in and sends
 * to the gateway account's own number:
 *
 *   npx tsx scripts/verify-booking-notification.ts           # no messages sent
 *   npx tsx scripts/verify-booking-notification.ts --live     # smoke test send
 */
import "dotenv/config";

import mongoose from "mongoose";
import Booking from "../src/modules/bookings/booking.model.js";
import {
    buildBookingConfirmationVariables,
    notifyBookingConfirmed,
} from "../src/modules/bookings/booking-notification.service.js";
import { sendTemplateSms } from "../src/utils/sms.service.js";

const line = (label: string) => console.log(`\n===== ${label} =====`);

const run = async (): Promise<void> => {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error("MONGO_URI is missing in .env");
    const realApiUrl = process.env.SMS_API_URL ?? "";
    await mongoose.connect(uri);

    // ---------------------------------------------------------------- case 1
    line("1. Variable mapping (in-memory, not saved)");
    const fake = new Booking({
        bookingNumber: "BK-2026-123456",
        applicant: { name: "Rina Das", mobile: "9876543210" },
        event: { name: "Grand Hall", type: "Wedding", expectedAttendance: 250 },
        schedule: {
            startDate: new Date("2026-08-21T00:00:00.000Z"),
            startTime: "18:30",
            endTime: "23:00",
        },
        financial: { totalAmount: 120000, advancePaid: 40000, balanceAmount: 80000 },
        signatures: { applicantPhoto: "a", managerPhoto: "m" },
        bookedByStaff: "Amit",
        createdBy: new mongoose.Types.ObjectId(),
        createdByName: "Amit",
    });
    console.log(
        JSON.stringify(
            buildBookingConfirmationVariables(fake, "919999999999"),
            null,
            4
        )
    );

    // ---------------------------------------------------------------- case 2
    line("2. Variable mapping against the newest real booking (read-only)");
    const real = await Booking.findOne().sort({ createdAt: -1 });
    if (real) {
        console.log(
            JSON.stringify(
                buildBookingConfirmationVariables(real, "919999999999"),
                null,
                4
            )
        );
    } else {
        console.log("(no booking in the database)");
    }

    // ---------------------------------------------------------------- case 3
    line("3. Not ready (no signatures) → must be a no-op");
    const incomplete = new Booking({
        bookingNumber: "BK-VERIFY-000001",
        applicant: { name: "Test", mobile: "9000000001" },
        createdBy: new mongoose.Types.ObjectId(),
        createdByName: "Test",
    });
    console.log(await notifyBookingConfirmed(incomplete));

    // ---------------------------------------------------------------- case 4
    line("4. Ready booking, dead gateway → claim + release");
    process.env.SMS_API_URL = "http://127.0.0.1:9/blackhole";
    process.env.SMS_TIMEOUT_MS = "1500";

    const ready = await Booking.create({
        bookingNumber: `BK-VERIFY-${Date.now()}`,
        applicant: { name: "Verify Guest", mobile: "9000000002" },
        event: { name: "Verify Hall", type: "Wedding", expectedAttendance: 120 },
        schedule: {
            startDate: new Date("2026-12-01T00:00:00.000Z"),
            endDate: new Date("2026-12-01T00:00:00.000Z"),
            startTime: "10:00 AM",
            endTime: "04:00 PM",
        },
        financial: { totalAmount: 50000, advancePaid: 10000, balanceAmount: 40000 },
        signatures: { applicantPhoto: "a", managerPhoto: "m" },
        bookedByStaff: "Verify Staff",
        createdBy: new mongoose.Types.ObjectId(),
        createdByName: "Verify Staff",
        status: "Confirmed",
    });

    const firstTry = await notifyBookingConfirmed(ready);
    console.log("first call  :", firstTry);
    const afterFailure = await Booking.findById(ready._id).select(
        "confirmationNotifiedAt"
    );
    console.log(
        "marker after failure (null = retryable):",
        afterFailure?.confirmationNotifiedAt ?? null
    );

    const secondTry = await notifyBookingConfirmed(ready);
    console.log("second call :", secondTry.sent, secondTry.skipped);

    // Marker already set → the claim must be refused without any gateway call.
    await Booking.updateOne(
        { _id: ready._id },
        { $set: { confirmationNotifiedAt: new Date() } }
    );
    const thirdTry = await notifyBookingConfirmed(ready);
    console.log("third call  :", thirdTry.sent, thirdTry.skipped);

    await Booking.deleteOne({ _id: ready._id });
    console.log("temporary booking removed");

    // ---------------------------------------------------------------- case 5
    line("5. Live template smoke test (opt-in: pass --live)");
    if (!process.argv.includes("--live")) {
        console.log("skipped - run: npx tsx scripts/verify-booking-notification.ts --live");
    } else {
        // Restore the real gateway URL that case 4 deliberately killed.
        process.env.SMS_API_URL = realApiUrl;
        process.env.SMS_TIMEOUT_MS = "60000";
        const smoke = await sendTemplateSms({
            phone: "7796419792",
            variables: buildBookingConfirmationVariables(fake, "919999999999"),
            label: "Booking confirmation smoke test",
        });
        console.log({ ...smoke, response: smoke.response?.slice(0, 400) });
    }

    await mongoose.disconnect();
};

run().catch(async (error) => {
    console.error("verification failed:", error);
    await mongoose.disconnect();
    process.exit(1);
});
