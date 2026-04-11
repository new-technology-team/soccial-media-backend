import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";
import { ReportType } from "../../common/enum/report-type.enum";
import { ReportStatus } from "../../common/enum/report-status.enum";


@Entity()
export class Report {
    @PrimaryGeneratedColumn()
    reportId: number;

    @Column()
    status: ReportStatus;

    @Column()
    createAt: Date;

    @Column()
    description: string;

    @Column()
    targetId: string;

    @Column()
    reportType: ReportType;

    @Column()
    userId: number;

    constructor(
        reportId: number,
        status: ReportStatus,
        createAt: Date,
        description: string,
        targetId: string,
        reportType: ReportType,
        userId: number
    ) {
        this.reportId = reportId;
        this.status = status;
        this.createAt = createAt;
        this.description = description;
        this.targetId = targetId;
        this.reportType = reportType;
        this.userId = userId;
    }
}