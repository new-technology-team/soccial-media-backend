import { ReportType } from "../../common/enum/report-type.enum";
import { ReportStatus } from "../../common/enum/report-status.enum";
export declare class Report {
    reportId: number;
    status: ReportStatus;
    createAt: Date;
    updatedAt: Date | null;
    description: string;
    targetId: string;
    resolutionNote: string | null;
    reviewerId: number | null;
    reportType: ReportType;
    userId: number;
}
//# sourceMappingURL=report.entity.d.ts.map