import { InteractType } from '../../common/enum/interact-type.enum';

export class Interacts {
  userId: number;
  displayName: string;
  avatarUrl: string;
  interactType: InteractType;
  createdAt: Date;
  constructor(
    userId: number,
    displayName: string,
    avatarUrl: string,
    interactType: InteractType,
    createdAt: Date,
  ) {
    this.userId = userId;
    this.displayName = displayName;
    this.avatarUrl = avatarUrl;
    this.interactType = interactType;
    this.createdAt = createdAt;
  }
}
