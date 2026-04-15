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

    @Column({ nullable: true })
    updatedAt: Date | null;

    @Column()
    description: string;

    @Column()
    targetId: string;

    @Column({ nullable: true })
    resolutionNote: string | null;

    @Column({ nullable: true })
    reviewerId: number | null;

    @Column()
    reportType: ReportType;

    @Column()
    userId: number;
}