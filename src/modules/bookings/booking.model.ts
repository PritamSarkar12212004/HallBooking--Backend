import mongoose, { Schema } from "mongoose";
import { IBooking } from "./booking.type.js";

const bookingSchema = new Schema<IBooking>(
    {
        bookingNumber: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },

        eventImage: {
            type: String,
            default: "",
        },

        hall: {
            _id: {
                type: Schema.Types.ObjectId,
            },
            name: {
                type: String,
            },
            capacity: {
                type: Number,
            },
        },

        hallId: {
            type: Schema.Types.ObjectId,
            ref: "Hall",
        },

        applicant: {
            name: {
                type: String,
                default: "",
                trim: true,
            },
            organization: { type: String, default: "" },
            mobile: {
                type: String,
                default: "",
                trim: true,
            },
            address: {
                type: String,
                default: "",
            },
            email: { type: String, default: "" },

            governmentId: {
                type: {
                    type: String,
                    default: "",
                },
                /** Custom "Other ID" naam (fixed cards par khaali rehta hai). */
                name: {
                    type: String,
                    default: "",
                    trim: true,
                },
                number: {
                    type: String,
                    default: "",
                },
                photo: { type: String, default: "" },
            },
        },

        event: {
            type: {
                type: String,
                default: "",
            },
            /** "Other" event type ka manually type kiya gaya naam. */
            customType: {
                type: String,
                default: "",
                trim: true,
            },
            /** Evidence / reference photo (Cloudinary URL). */
            evidencePhoto: {
                type: String,
                default: "",
            },
            expectedAttendance: {
                type: Number,
                default: 0,
                min: 0,
            },
            timeSlots: {
                type: [String],
                default: [],
            },
            hallRequirements: {
                type: [String],
                default: [],
            },
            /** Har selected hall requirement ki quantity. */
            requirementQuantities: {
                type: [
                    new Schema(
                        {
                            label: { type: String, required: true, trim: true },
                            quantity: { type: Number, default: 0, min: 0 },
                        },
                        { _id: false }
                    ),
                ],
                default: [],
            },
            name: {
                type: String,
                default: "",
            },
        },

        arrangements: {
            decorator: {
                name: String,
                contact: String,
                timing: String,
            },

            caterer: {
                name: String,
                contact: String,
            },

            kitchenRequired: {
                type: Boolean,
                default: false,
            },
        },

        schedule: {
            startDate: {
                type: Date,
                required: true,
            },
            endDate: {
                type: Date,
                required: true,
            },
            startTime: {
                type: String,
                required: true,
            },
            endTime: {
                type: String,
                required: true,
            },
        },

        financial: {
            // Actual amount breakdown. Total is derived from these.
            charges: {
                type: [
                    new Schema(
                        {
                            label: { type: String, required: true, trim: true },
                            amount: { type: Number, default: 0, min: 0 },
                            paid: { type: Number, default: 0, min: 0 },
                        },
                        { _id: false }
                    ),
                ],
                default: [],
            },
            // Unit / consumption breakdown (water, light, AC, custom).
            units: {
                type: [
                    new Schema(
                        {
                            label: { type: String, required: true, trim: true },
                            quantity: { type: Number, default: 0, min: 0 },
                            perUnit: { type: Number, default: 0, min: 0 },
                            // Meter reading — recorded only, never charged.
                            currentUnit: { type: Number, default: 0, min: 0 },
                            // Optional meter photo (Cloudinary URL) as reading evidence.
                            meterPhoto: { type: String, default: "" },
                            amount: { type: Number, default: 0, min: 0 },
                            paid: { type: Boolean, default: false },
                        },
                        { _id: false }
                    ),
                ],
                default: [],
            },
            // Refundable — excluded from total/balance calculations.
            securityDeposit: {
                type: Number,
                default: 0,
                min: 0,
            },
            // Deposit return tracking (updated at event end via Finalize Event).
            securityDepositReturned: {
                type: Boolean,
                default: false,
            },
            // Amount deducted from the deposit (₹) at return time.
            securityDepositDeducted: {
                type: Number,
                default: 0,
                min: 0,
            },
            // Reason for the deduction (damage, extra consumption, etc.).
            securityDepositReason: {
                type: String,
                default: "",
                trim: true,
            },
            // Derived caches (recomputed on every payment update).
            totalAmount: {
                type: Number,
                default: 0,
                min: 0,
            },
            advancePaid: {
                type: Number,
                default: 0,
                min: 0,
            },
            balanceAmount: {
                type: Number,
                default: 0,
                min: 0,
            },
            mode: {
                type: String,
            },
        },

        // Audit trail: who changed which financial field, when, old → new.
        financeHistory: [
            {
                editedByName: { type: String, default: "" },
                editedByMobile: { type: String, default: "" },
                editedAt: { type: Date, default: Date.now },
                changes: [
                    {
                        field: { type: String },
                        from: { type: Number },
                        to: { type: Number },
                    },
                ],
                balanceAfter: { type: Number, default: 0 },
                // Revision ke waqt ka finance picture (charges + units + totals)
                // — history UI isse amount aur units alag-alag sections me
                // dikhata hai.
                snapshot: { type: Schema.Types.Mixed, default: null },
            },
        ],

        payments: [
            {
                amount: {
                    type: Number,
                    required: true,
                    min: 0,
                },
                mode: {
                    type: String,
                    enum: ["Cash", "UPI", "Cheque", "NEFT/RTGS"],
                    required: true,
                },
                transactionId: { type: String, default: "" },
                receivedBy: {
                    type: Schema.Types.ObjectId,
                    ref: "User",
                    required: true,
                },
                receivedAt: {
                    type: Date,
                    default: Date.now,
                },
                proof: { type: String, default: "" },
            },
        ],

        paymentStatus: {
            type: String,
            enum: ["Paid", "Partial", "Pending"],
            default: "Pending",
        },

        signatures: {
            applicantPhoto: { type: String, default: "" },
            managerPhoto: { type: String, default: "" },
            termsAcceptedAt: Date,
            termsVersion: { type: String, default: "" },
        },

        handover: {
            items: [
                {
                    label: {
                        type: String,
                        required: true,
                    },
                    checked: {
                        type: Boolean,
                        default: false,
                    },
                    remark: String,
                    photo: String,
                },
            ],
            completedAt: Date,
        },

        status: {
            type: String,
            enum: [
                "Draft",
                "Pending",
                "Office-Approved",
                "Confirmed",
                "Cancelled",
                "Ended",
            ],
            default: "Draft",
        },

        approvedBy: {
            user: {
                type: Schema.Types.ObjectId,
                ref: "User",
            },
            at: Date,
            note: String,
        },

        bookedByStaff: {
            type: String,
            default: "",
            trim: true,
        },

        createdBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        createdByName: {
            type: String,
            required: true,
        },

        // WhatsApp confirmation marker. Deliberately has no default so the
        // `confirmationNotifiedAt: { $exists: false }` guard keeps working.
        confirmationNotifiedAt: Date,

        // Admin copy of the same confirmation — separate marker so the two
        // notifications retry independently of each other.
        adminNotifiedAt: Date,
    },
    {
        timestamps: true,
    }
);


bookingSchema.index({ hallId: 1 });
bookingSchema.index({ "schedule.startDate": 1 });
bookingSchema.index({ "schedule.endDate": 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ paymentStatus: 1 });
// Applicant list is grouped by mobile (fallback: name), so both fields are
// indexed to keep the applicant aggregation's matching stage fast.
bookingSchema.index({ "applicant.mobile": 1 });
bookingSchema.index({ "applicant.name": 1 });

const Booking = mongoose.model<IBooking>(
    "Booking",
    bookingSchema
);

export default Booking;