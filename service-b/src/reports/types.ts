export enum ReportInterval {
  HOUR = 'hour',
  DAY = 'day',
}

export interface PDFReportData {
  title: string;
  startDate: Date;
  endDate: Date;
  timeSeriesData: any[];
  stats: {
    totalLogs: number;
    byEventType: { type: string; count: number }[];
    byAction: { action: string; count: number }[];
    byService: { service: string; count: number }[];
  };
}
