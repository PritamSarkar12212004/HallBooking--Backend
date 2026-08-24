import mongoose, { Schema } from "mongoose";
const userSchema = new Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    phone: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    email: {
        type: String,
        unique: true,
        sparse: true,
        lowercase: true,
        trim: true,
    },
    password: {
        type: String,
        required: true,
        select: false,
    },
    avatar: {
        type: String,
        default: null,
    },
    photo: {
        type: String,
        default: null,
    },
    role: {
        type: String,
        enum: ["CEO", "OFFICE", "STAFF"],
        default: "STAFF",
        required: true,
    },
    fcmToken: {
        type: String,
        default: null,
    },
}, {
    timestamps: true,
});
const User = mongoose.model("User", userSchema);
export default User;
//# sourceMappingURL=user.model.js.map