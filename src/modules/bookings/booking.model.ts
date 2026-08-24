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

        hall: {
            _id: {
                type: Schema.Types.ObjectId,
                required: true,
            },
            name: {
                type: String,
                required: true,
            },
            capacity: {
                type: Number,
                required: true,
            },
        },

        hallId: {
            type: Schema.Types.ObjectId,
            ref: "Hall",
            index: true,
        },

        applicant: {
            name: {
                type: String,
                required: true,
                trim: true,
            },
            organization: String,
            mobile: {
                type: String,
                required: true,
                trim: true,
            },
            address: {
                type: String,
                required: true,
            },
            email: String,

            governmentId: {
                type: {
                    type: String,
                    required: true,
                },
                number: {
                    type: String,
                    required: true,
                },
                photo: String,
            },
        },

        event: {
            type: {
                type: String,
                required: true,
            },
            expectedAttendance: {
                type: Number,
                required: true,
                min: 1,
            },
            timeSlots: {
                type: [String],
                default: [],
            },
            hallRequirements: {
                type: [String],
                default: [],
            },
            name: {
                type: String,
                required: true,
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
            hallRent: {
                type: Number,
                required: true,
                min: 0,
            },
            securityDeposit: {
                type: Number,
                default: 0,
                min: 0,
            },
            totalAmount: {
                type: Number,
                required: true,
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
        },

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
                transactionId: String,
                receivedBy: {
                    type: Schema.Types.ObjectId,
                    ref: "User",
                    required: true,
                },
                receivedAt: {
                    type: Date,
                    default: Date.now,
                },
                proof: String,
            },
        ],

        paymentStatus: {
            type: String,
            enum: ["Paid", "Partial", "Pending"],
            default: "Pending",
        },

        signatures: {
            applicantPhoto: String,
            managerPhoto: String,
            termsAcceptedAt: Date,
            termsVersion: String,
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
                "Pending",
                "Office-Approved",
                "Confirmed",
                "Cancelled",
            ],
            default: "Pending",
            index: true,
        },

        approvedBy: {
            user: {
                type: Schema.Types.ObjectId,
                ref: "User",
            },
            at: Date,
            note: String,
        },

        allocatedTeam: [
            {
                type: Schema.Types.ObjectId,
                ref: "User",
            },
        ],

        createdBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        createdByName: {
            type: String,
            required: true,
        },
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

const Booking = mongoose.model<IBooking>(
    "Booking",
    bookingSchema
);

export default Booking;