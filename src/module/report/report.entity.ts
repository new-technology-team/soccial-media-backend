import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";
import { ReportType } from "../../common/enum/report-type.enum";
import { ReportStatus } from "../../common/enum/report-status.enum";


@Entity()
export class Report {
    @PrimaryGeneratedColumn()
    reportId: number;

    @Column({
        type: "enum",
        enum: ReportStatus,
        default: ReportStatus.PENDING,
    })
    status: ReportStatus;

    @Column({ type: "datetime" })
    createAt: Date;

    @Column({ type: "datetime", nullable: true })
    updatedAt: Date | null;

    @Column({ type: "text" })
    description: string;

    @Column({ type: "varchar", length: 64 })
    targetId: string;

    @Column({ type: "text", nullable: true })
    resolutionNote: string | null;

    @Column({ type: "int", nullable: true })
    reviewerId: number | null;

    @Column({ type: "int", nullable: true })
    assignedTo: number | null;

    @Column({ type: "int", nullable: true })
    resolvedBy: number | null;

    @Column({ type: "varchar", length: 120, nullable: true })
    reason: string | null;

    @Column({
        type: "enum",
        enum: ReportType,
    })
    reportType: ReportType;

    @Column({ type: "int" })
    userId: number;
}
