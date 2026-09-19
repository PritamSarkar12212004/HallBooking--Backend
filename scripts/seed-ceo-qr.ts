/**
 * Seed harness: dummy CEO user + hall payment QR (dummy).
 *
 * Kya karta hai
 *   1. Dummy CEO user upsert karta hai — `role: "CEO"`, profile complete — taake
 *      OTP login ke baad app seedha CEO experience dikhaye.
 *   2. QrSettings (singleton, key "hall") me dummy QR image + bank holder name
 *      likhta hai — payment screen ka "Scan to Pay (UPI)" card isse bharta hai.
 *
 * Chalane ka tarika
 *   npx tsx scripts/seed-ceo-qr.ts                        # dummy CEO + dummy QR
 *   npx tsx scripts/seed-ceo-qr.ts --phone=9000000000     # dusra phone number
 *   npx tsx scripts/seed-ceo-qr.ts --holder="Dummy Hall"  # dusra bank holder
 *   npx tsx scripts/seed-ceo-qr.ts --qr=https://...png    # apna QR image URL
 *   npx tsx scripts/seed-ceo-qr.ts --keep-qr              # mojooda QR na chhero
 *   npx tsx scripts/seed-ceo-qr.ts --dry                  # sirf dikhao, save na karo
 *   npx tsx scripts/seed-ceo-qr.ts --restore=scripts/qr-backup-<ts>.json
 *
 * Mojooda QR overwrite hone se PEHLE uska backup `scripts/qr-backup-<ts>.json`
 * me likh diya jaata hai, isliye `--restore` se wapas laaya ja sakta hai.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";

import mongoose from "mongoose";

import User from "../src/modules/user/user.model.js";
import QrSettings, { QR_SETTINGS_KEY } from "../src/modules/payment-qr/qr.model.js";
import { validateSaveQrSettings } from "../src/modules/payment-qr/qr.validation.js";

/* --------------------------------- defaults --------------------------------- */

const DUMMY_PHONE = "9000000000";
const DUMMY_NAME = "Dummy CEO";
const DUMMY_EMAIL = "dummy.ceo@hallbooking.test";
const DUMMY_CITY = "Kolkata";
const DUMMY_GENDER = "male";
const DUMMY_PASSWORD = "dummy-ceo-seed"; // OTP login me use nahi hota.

/** Asli scan karne layak dummy UPI QR (goqr.me image service). */
const DUMMY_QR_URL =
    "https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=upi%3A%2F%2Fpay%3Fpa%3Ddummyhall%40upi%26pn%3DDummy%2520Hall%2520Booking%26cu%3DINR";

const DUMMY_BANK_HOLDER = "Dummy Hall Booking";

/* ------------------------------------ args ------------------------------------ */

type Options = {
    phone: string;
    holder: string;
    qrUrl: string;
    /** Mojooda QR ko na chhero. */
    keepQr: boolean;
    /** Sirf print karo, kuch save na karo. */
    dry: boolean;
    /** Backup file se QR wapas laao. */
    restoreFile: string | null;
};

const readFlag = (name: string): string | null => {
    const prefix = `--${name}=`;
    const hit = process.argv.slice(2).find((arg) => arg.startsWith(prefix));

    return hit ? hit.slice(prefix.length).trim() : null;
};

const hasFlag = (name: string): boolean =>
    process.argv.slice(2).includes(`--${name}`);

const options: Options = {
    phone: (readFlag("phone") || DUMMY_PHONE).replace(/\D/g, "").slice(-10),
    holder: readFlag("holder") || DUMMY_BANK_HOLDER,
    qrUrl: readFlag("qr") || DUMMY_QR_URL,
    keepQr: hasFlag("keep-qr"),
    dry: hasFlag("dry"),
    restoreFile: readFlag("restore"),
};

/* ----------------------------------- helpers ----------------------------------- */

const line = (label: string) => console.log(`\n===== ${label} =====`);

const qrBackupPath = () =>
    path.join(
        "scripts",
        `qr-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
    );

const writeBackup = (values: { bankHolderName?: string; qrUrl?: string }) => {
    const file = qrBackupPath();
    fs.writeFileSync(file, `${JSON.stringify(values, null, 4)}\n`, "utf8");
    console.log(`Old QR ka backup: ${file}`);
    console.log(`Wapas laane ke liye: npx tsx scripts/seed-ceo-qr.ts --restore=${file}`);

    return file;
};

/* ------------------------------------- run ------------------------------------- */

const run = async (): Promise<void> => {
    const uri = process.env.MONGO_URI;
    if (!uri) {
        throw new Error("MONGO_URI is missing in .env");
    }

    await mongoose.connect(uri);
    console.log(`DB: ${mongoose.connection.name} @ ${mongoose.connection.host}`);
    console.log(`Dry run: ${options.dry ? "haan (kuch save nahi hoga)" : "nahi"}`);

    /* ------------------------------ 1. dummy CEO ------------------------------ */

    line("Dummy CEO user");

    const users = mongoose.connection.collection("users");
    // Raw doc, kyunki `city` / `gender` / `isProfileComplete` user.model schema
    // me nahi hain (wo auth model ke fields hain).
    const previousUser =
        (await users.findOne({ phone: options.phone })) as {
            name?: string;
            email?: string;
            city?: string;
            gender?: string;
            role?: string;
            isProfileComplete?: boolean;
        } | null;

    if (previousUser) {
        console.log(
            `Pehle se maujood: name="${previousUser.name ?? ""}" | role=${
                previousUser.role ?? "-"
            } | email=${previousUser.email || "-"} | city=${
                previousUser.city || "-"
            } | gender=${previousUser.gender || "-"} | profileComplete=${
                previousUser.isProfileComplete === true
            }`
        );
    } else {
        console.log(`${options.phone} par koi user nahi tha — naya banega.`);
    }

    if (!options.dry) {
        // Account naya ho to pehle model se banate hain (required fields +
        // role enum validate hote hain), phir khaali fields bhar dete hain.
        if (!previousUser) {
            await User.create({
                phone: options.phone,
                name: DUMMY_NAME,
                email: DUMMY_EMAIL,
                password: DUMMY_PASSWORD,
                role: "CEO",
            });
        }

        // Sirf KHAALI / missing fields bharte hain — asli data (name, city,
        // gender, email) kabhi overwrite nahi hota. `role` sirf tab set hota hai
        // jab wo pehle se CEO na ho.
        const fill: Record<string, unknown> = {
            isProfileComplete: true,
        };
        if (!String(previousUser?.name ?? "").trim()) fill.name = DUMMY_NAME;
        if (!String(previousUser?.email ?? "").trim()) fill.email = DUMMY_EMAIL;
        if (!String(previousUser?.city ?? "").trim()) fill.city = DUMMY_CITY;
        if (!String(previousUser?.gender ?? "").trim()) fill.gender = DUMMY_GENDER;
        if (previousUser?.role !== "CEO") fill.role = "CEO";

        const updated = await users.updateOne(
            { phone: options.phone },
            { $set: fill }
        );

        console.log(
            `Updated (matched: ${updated.matchedCount}, modified: ${updated.modifiedCount}) → ${Object.keys(
                fill
            ).join(", ")}`
        );
    }

    /* ------------------------------- 2. payment QR ------------------------------- */

    line("Payment QR (QrSettings)");

    const current = await QrSettings.findOne({ key: QR_SETTINGS_KEY }).lean();
    console.log(
        current
            ? `Abhi saved: bankHolderName="${current.bankHolderName}" | qrUrl=${current.qrUrl}`
            : "Abhi kuch set nahi hai (CEO ne kabhi upload nahi kiya)."
    );

    if (options.restoreFile) {
        const raw = fs.readFileSync(options.restoreFile, "utf8");
        const parsed = JSON.parse(raw) as {
            bankHolderName?: string;
            qrUrl?: string;
        };
        const restored = validateSaveQrSettings({ ...parsed });

        if (!options.dry) {
            const saved = await QrSettings.findOneAndUpdate(
                { key: QR_SETTINGS_KEY },
                { $set: { ...restored, updatedByPhone: options.phone } },
                {
                    upsert: true,
                    new: true,
                    setDefaultsOnInsert: true,
                    runValidators: true,
                }
            ).lean();
            console.log(`Restored: ${saved?.bankHolderName} | ${saved?.qrUrl}`);
        }
    } else if (current && options.keepQr) {
        console.log("--keep-qr diya tha — mojooda QR waise hi rakha gaya.");
    } else {
        if (current) {
            if (!options.dry) writeBackup({
                bankHolderName: current.bankHolderName,
                qrUrl: current.qrUrl,
            });
        }

        // Wahi validation jo CEO ke PUT /payment-qr par lagti hai.
        const next = validateSaveQrSettings({
            bankHolderName: options.holder,
            qrUrl: options.qrUrl,
        });

        if (!options.dry) {
            const saved = await QrSettings.findOneAndUpdate(
                { key: QR_SETTINGS_KEY },
                { $set: { ...next, updatedByPhone: options.phone } },
                {
                    upsert: true,
                    new: true,
                    setDefaultsOnInsert: true,
                    runValidators: true,
                }
            ).lean();

            console.log(`Saved (dummy): ${saved?.bankHolderName} | ${saved?.qrUrl}`);
        } else {
            console.log(
                `Save hota (dummy): ${next.bankHolderName} | ${next.qrUrl}`
            );
        }
    }

    line("Login kaise karein");
    console.log(
        `Phone: ${options.phone} — OTP usi number par SMS jaayega (gateway par\n` +
            `registered number hona chahiye).\n` +
            `Local backend (NODE_ENV production ke bina) chalane par POST /api/v1/auth/send-otp\n` +
            `ke response me "devOtp" bhi aata hai — usse kisi bhi number se login ho jaata hai.`
    );

    await mongoose.disconnect();
};

run().catch(async (error) => {
    console.error("Seed failed:", error instanceof Error ? error.message : error);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
});
