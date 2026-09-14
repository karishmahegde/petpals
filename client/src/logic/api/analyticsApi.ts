// What it does: API functions for Admin-only org-wide analytics.
import axiosInstance from "./axiosInstance";

interface AnalyticsCountGroup {
  total: number;
  byStatus: Record<string, number>;
}

export interface AnalyticsOverview {
  shelters: AnalyticsCountGroup;
  pets: AnalyticsCountGroup;
  adopters: AnalyticsCountGroup;
  applications: AnalyticsCountGroup & {
    // 0-1 fraction, Accepted / total — null when there are no applications yet.
    adoptionRate: number | null;
  };
}

export const getAnalyticsOverview = async (): Promise<AnalyticsOverview> => {
  const response = await axiosInstance.get("/analytics/overview");
  return response.data.data;
};

// ———————————————— SHELTER BREAKDOWN ————————————————
// The one endpoint behind the Admin Shelters tab: capacity analytics plus
// the identifying/contact fields, shelterStatus and current manager — enough
// to render the list and pre-fill the edit form without a second call.
export interface ShelterAnalyticsItem {
  shelterID: number;
  shelterName: string;
  shelterAddress: string;
  shelterPhone: string;
  shelterEmail: string;
  shelterZIP: number;
  shelterSize: number;
  shelterStatus: "Open" | "Full" | "Closed";
  managerStaffID: number | null;
  managerName: string | null;
  petCount: number;
  petsByStatus: Record<string, number>;
  openApplicationCount: number;
  staffCount: number;
  // Percentage (not a 0-1 fraction) rounded to 2dp — null for a 0-capacity shelter.
  utilization: number | null;
}

export const getShelterAnalytics = async (
  sortBy?: "utilization" | "petCount",
): Promise<ShelterAnalyticsItem[]> => {
  const response = await axiosInstance.get("/analytics/shelters", {
    params: sortBy ? { sortBy } : undefined,
  });
  return response.data.data;
};

// ———————————————— MONTHLY STATS ————————————————
// Jan-Dec of one calendar year, for the Overview "Stats" chart.
export interface MonthlyStatsPoint {
  month: string;
  year: number;
  intake: number;
  adoptions: number;
}

export const getMonthlyStats = async (
  year: number,
): Promise<MonthlyStatsPoint[]> => {
  const response = await axiosInstance.get("/analytics/monthly-stats", {
    params: { year },
  });
  return response.data.data;
};
