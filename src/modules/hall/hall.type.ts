export type HallStatus = "active" | "inactive" | "maintenance";

export interface IAddress {
    line: string;
    city: string;
    state: string;
    pincode: string;
}

export interface ILocation {
    type: "Point";
    coordinates: [number, number];
}

export interface IHall {
    name: string;

    images: string[];

    capacity: number;

    address: IAddress;

    location?: ILocation;

    status: HallStatus;

    isActive: boolean;

    createdAt: Date;

    updatedAt: Date;
}