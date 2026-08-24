export type UserRoleDb = "CEO" | "OFFICE" | "STAFF";

export interface IUserDb extends Document {
    name: string;
    phone: string;
    email: string;
    password: string;
    avatar?: string;
    role: UserRoleDb;
    fcmToken: string;
    createdAt: Date;
    updatedAt: Date;
}