import mongoose, { Schema } from "mongoose";
const hallSchema = new Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    images: {
        type: [String],
        default: [],
    },
    capacity: {
        type: Number,
        required: true,
        min: 1,
    },
    address: {
        line: {
            type: String,
            required: true,
            trim: true,
        },
        city: {
            type: String,
            required: true,
            trim: true,
        },
        state: {
            type: String,
            required: true,
            trim: true,
        },
        pincode: {
            type: String,
            required: true,
            trim: true,
        },
    },
    location: {
        type: {
            type: String,
            enum: ["Point"],
            default: "Point",
        },
        coordinates: {
            type: [Number],
            validate: {
                validator: (value) => value.length === 2 &&
                    value.every((coordinate) => Number.isFinite(coordinate)),
                message: "Coordinates must be [longitude, latitude]",
            },
        },
    },
    status: {
        type: String,
        enum: ["active", "inactive", "maintenance"],
        default: "active",
    },
    isActive: {
        type: Boolean,
        default: true,
    },
}, {
    timestamps: true,
});
hallSchema.index({
    location: "2dsphere",
});
const Hall = mongoose.model("Hall", hallSchema);
export default Hall;
//# sourceMappingURL=hall.model.js.map