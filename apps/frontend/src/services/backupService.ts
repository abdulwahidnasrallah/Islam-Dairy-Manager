import type { BackupFile } from "@idm/shared-types";
import { apiClient } from "./apiClient";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";

export const backupService = {
  list: () => apiClient.get<BackupFile[]>("/backup"),

  create: () => apiClient.post<BackupFile>("/backup", {}),

  remove: (filename: string) => apiClient.delete<null>(`/backup/${filename}`),

  restore: (filename: string) =>
    apiClient.post<{ safetyBackupFilename: string }>(`/backup/${filename}/restore`, {}),

  downloadUrl: (filename: string) => `${BASE_URL}/backup/${filename}/download`,
};
