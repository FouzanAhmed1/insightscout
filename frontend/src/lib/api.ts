const API_BASE = "";

function cleanParams(params?: Record<string, any>): string {
  if (!params) return "";
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") clean[k] = String(v);
  }
  const q = new URLSearchParams(clean).toString();
  return q ? `?${q}` : "";
}

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
    if (token) localStorage.setItem("token", token);
    else localStorage.removeItem("token");
  }

  getToken(): string | null {
    if (!this.token && typeof window !== "undefined") {
      this.token = localStorage.getItem("token");
    }
    return this.token;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    if (res.status === 401) {
      this.setToken(null);
      if (typeof window !== "undefined") window.location.href = "/auth";
      throw new Error("Unauthorized");
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Request failed");
    }
    if (res.status === 204) return null as T;
    return res.json();
  }

  // Auth
  async register(email: string, password: string, fullName: string) {
    const data = await this.request<{ access_token: string }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, full_name: fullName }),
    });
    this.setToken(data.access_token);
    return data;
  }

  async login(email: string, password: string) {
    const data = await this.request<{ access_token: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    this.setToken(data.access_token);
    return data;
  }

  async getMe() {
    return this.request<any>("/api/auth/me");
  }

  logout() {
    this.setToken(null);
  }

  // Dashboard
  async getDashboardStats() {
    return this.request<any>("/api/dashboard/stats");
  }

  async getSentimentTrends(days: number = 30) {
    return this.request<any[]>(`/api/dashboard/sentiment-trends?days=${days}`);
  }

  // Competitors
  async getCompetitors(params?: { industry?: string; search?: string; sort_by?: string }) {
    return this.request<any[]>(`/api/competitors/${cleanParams(params)}`);
  }

  async getCompetitor(id: string) {
    return this.request<any>(`/api/competitors/${id}`);
  }

  async createCompetitor(data: any) {
    return this.request<any>("/api/competitors/", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateCompetitor(id: string, data: any) {
    return this.request<any>(`/api/competitors/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async deleteCompetitor(id: string) {
    return this.request<void>(`/api/competitors/${id}`, { method: "DELETE" });
  }

  // Activities
  async getActivities(params?: { competitor_id?: string; type?: string; limit?: number }) {
    return this.request<any[]>(`/api/activities/${cleanParams(params)}`);
  }

  // Sentiment
  async getSentiment(params?: { competitor_id?: string; days?: number }) {
    return this.request<any[]>(`/api/sentiment/${cleanParams(params)}`);
  }

  async getSentimentSummary() {
    return this.request<any[]>("/api/sentiment/summary");
  }

  async analyzeSentiment(text: string, competitorId?: string) {
    return this.request<any>("/api/sentiment/analyze", {
      method: "POST",
      body: JSON.stringify({ text, competitor_id: competitorId }),
    });
  }

  // Insights
  async getInsights(params?: { type?: string }) {
    return this.request<any[]>(`/api/insights/${cleanParams(params)}`);
  }

  async generateInsights() {
    return this.request<any>("/api/insights/generate", { method: "POST" });
  }

  // Alerts
  async getAlerts() {
    return this.request<any[]>("/api/alerts/");
  }

  async createAlert(data: any) {
    return this.request<any>("/api/alerts/", { method: "POST", body: JSON.stringify(data) });
  }

  async updateAlert(id: string, data: any) {
    return this.request<any>(`/api/alerts/${id}`, { method: "PATCH", body: JSON.stringify(data) });
  }

  async deleteAlert(id: string) {
    return this.request<void>(`/api/alerts/${id}`, { method: "DELETE" });
  }

  // Monitoring
  async getSnapshots(competitorId?: string) {
    const q = competitorId ? `?competitor_id=${competitorId}` : "";
    return this.request<any[]>(`/api/monitoring/snapshots${q}`);
  }

  async triggerMonitoring(competitorId: string, url: string) {
    return this.request<any>("/api/monitoring/trigger", {
      method: "POST",
      body: JSON.stringify({ competitor_id: competitorId, url }),
    });
  }

  // Ingestion
  async getIngestionJobs() {
    return this.request<any[]>("/api/ingestion/jobs");
  }

  async triggerIngestion(source: string, competitorId?: string) {
    return this.request<any>("/api/ingestion/trigger", {
      method: "POST",
      body: JSON.stringify({ source, competitor_id: competitorId }),
    });
  }
}

export const api = new ApiClient();
