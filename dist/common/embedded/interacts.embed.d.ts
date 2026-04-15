import { InteractType } from "../../common/enum/interact-type.enum";
export declare class Interacts {
    userId: number;
    displayName: string;
    avatarUrl: string;
    interactType: InteractType;
    createdAt: Date;
    constructor(userId: number, displayName: string, avatarUrl: string, interactType: InteractType, createdAt: Date);
}
