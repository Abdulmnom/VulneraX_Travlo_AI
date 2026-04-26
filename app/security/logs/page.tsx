"use client";

import { useState, useEffect } from "react";
import { Shield, Filter, RefreshCw, Ban, AlertTriangle, Search } from "lucide-react";

interface AttackLog {
  id: string;
  timestamp: number;
  tenantId: string;
  ip: string;
  type: string;
  confidence: number;
  details: string;
  path: string;
  blocked: boolean;
  input: string;
}

export default function SecurityLogs() {
  const [logs, setLogs] = useState<AttackLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [filterTenant, setFilterTenant] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterBlocked, setFilterBlocked] = useState<boolean | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 3000);
    return () => clearInterval(interval);
  }, [filterTenant, filterType, filterBlocked]);

  async function fetchLogs() {
    try {
      let url = "/api/security/logs?limit=100";
      if (filterTenant) url += `\u0026tenant=${filterTenant}`;
      if (filterType) url += `\u0026type=${filterType}`;
      if (filterBlocked !== null) url += `\u0026blocked=${filterBlocked}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch logs");

      const data = await res.json();
      setLogs(data.logs);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  const filteredLogs = logs.filter((log) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      log.ip.toLowerCase().includes(query) ||
      log.type.toLowerCase().includes(query) ||
      log.details.toLowerCase().includes(query) ||
      log.tenantId.toLowerCase().includes(query)
    );
  });

  const attackTypes = Array.from(new Set(logs.map((l) => l.type)));
  const tenants = Array.from(new Set(logs.map((l) => l.tenantId)));

  function formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleString();
  }

  function getConfidenceColor(confidence: number): string {
    if (confidence >= 0.9) return "text-red-400";
    if (confidence >= 0.7) return "text-orange-400";
    return "text-yellow-400";
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <header className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Shield className="w-8 h-8 text-blue-500" />
          <div>
            <h1 className="text-2xl font-bold">Security Logs</h1>
            <p className="text-gray-400">Attack detection logs and monitoring</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-blue-500 outline-none"
            />
          </div>

          <select
            value={filterTenant}
            onChange={(e) => setFilterTenant(e.target.value)}
            className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg"
          >
            <option value="">All Tenants</option>
            {tenants.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg"
          >
            <option value="">All Types</option>
            {attackTypes.map((t) => (
              <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
            ))}
          </select>

          <select
            value={filterBlocked === null ? "" : filterBlocked.toString()}
            onChange={(e) => {
              const val = e.target.value;
              setFilterBlocked(val === "" ? null : val === "true");
            }}
            className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg"
          >
            <option value="">All Status</option>
            <option value="true">Blocked</option>
            <option value="false">Allowed</option>
          </select>

          <button
            onClick={fetchLogs}
            className="p-2 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="flex gap-6 mb-6 text-sm">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-yellow-500" />
          <span>Total: {logs.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <Ban className="w-4 h-4 text-green-500" />
          <span>Blocked: {logs.filter((l) => l.blocked).length}</span>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-blue-500" />
          <span>Filtered: {filteredLogs.length}</span>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading logs...</div>
      ) : error ? (
        <div className="text-center py-12 text-red-400">{error}</div>
      ) : filteredLogs.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No logs found</div>
      ) : (
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-900 text-left text-gray-400 text-sm">
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Tenant</th>
                  <th className="px-4 py-3">IP Address</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Confidence</th>
                  <th className="px-4 py-3">Path</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {filteredLogs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-gray-700/50 transition-colors"
                  >
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {formatTime(log.timestamp)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-gray-700 rounded text-xs">
                        {log.tenantId}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm">{log.ip}</td>
                    <td className="px-4 py-3">
                      <span className="capitalize text-sm">
                        {log.type.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className={`px-4 py-3 font-semibold ${getConfidenceColor(log.confidence)}`}>
                      {Math.round(log.confidence * 100)}%
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400 max-w-xs truncate">
                      {log.path}
                    </td>
                    <td className="px-4 py-3">
                      {log.blocked ? (
                        <span className="px-2 py-1 bg-green-900 text-green-300 rounded text-xs flex items-center gap-1 w-fit">
                          <Ban className="w-3 h-3" />
                          Blocked
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-yellow-900 text-yellow-300 rounded text-xs">
                          Allowed
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <footer className="mt-6 text-center">
        <a
          href="/security/dashboard"
          className="text-blue-400 hover:text-blue-300 underline"
        >
          Back to Dashboard
        </a>
      </footer>
    </div>
  );
}
