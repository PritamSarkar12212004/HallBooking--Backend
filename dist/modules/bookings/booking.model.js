import mongoose, { Schema } from "mongoose";
const bookingSchema = new Schema({
    bookingNumber: {
        type: String,
        required: true,
        unique: true,
        trim: true,
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
        hallRent: {
            type: Number,
            default: 0,
            min: 0,
        },
        securityDeposit: {
            type: Number,
            default: 0,
            min: 0,
        },
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
    allocatedTeam: {
        type: [String],
        default: [],
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
}, {
    timestamps: true,
});
bookingSchema.index({ hallId: 1 });
bookingSchema.index({ "schedule.startDate": 1 });
bookingSchema.index({ "schedule.endDate": 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ paymentStatus: 1 });
const Booking = mongoose.model("Booking", bookingSchema);
export default Booking;
//# sourceMappingURL=booking.model.js.map