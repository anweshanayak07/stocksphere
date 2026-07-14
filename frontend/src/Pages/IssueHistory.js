import React, { useEffect, useState } from "react";
import api from "../api";
import "./IssueHistory.css";

const IssueHistory = ({ user }) => {
  const [issues, setIssues] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterUser, setFilterUser] = useState("All");
  const [editId, setEditId] = useState(null);
  const [editData, setEditData] = useState({});

  const fetchIssues = async () => {
    setIsLoading(true);
    try {
      const response = await api.get("/api/issues?limit=100");
      setIssues(response.data.data || []);
      setError(null);
    } catch (err) {
      console.error("Error fetching issue history:", err);
      setError("Failed to load issue history.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteIssue = async (id) => {
    if (!window.confirm("Are you sure you want to delete this issue record?")) return;
    try {
      await api.delete(`/api/issues/${id}`);
      fetchIssues();
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Failed to delete record.");
    }
  };

  const handleEdit = (issue) => {
    setEditId(issue.id);
    setEditData({ ...issue, issue_date: issue.issue_date.split('.')[0] }); // Strip milliseconds for input
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditData({ ...editData, [name]: value });
  };

  const handleCancel = () => {
    setEditId(null);
    setEditData({});
  };

  const handleSave = async (id) => {
    try {
      await api.put(`/api/issues/${id}`, editData);
      setEditId(null);
      fetchIssues();
    } catch (err) {
      console.error("Update failed:", err);
      alert("Failed to update record.");
    }
  };

  useEffect(() => {
    fetchIssues();
  }, []);

  const filteredIssues = issues.filter(issue => {
    const matchesSearch = (issue.item_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (issue.issued_to || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (issue.sap_notification && issue.sap_notification.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesUser = filterUser === "All" || issue.issued_to === filterUser;
    return matchesSearch && matchesUser;
  });

  const uniqueUsers = ["All", ...new Set(issues.map(i => i.issued_to))];

  return (
    <div className="issue-history-container">
      <div className="history-header">
        <h1>History</h1>
        <div className="user-profile">
          Welcome, {user?.username || "Guest"} ({user?.role || "guest"})
        </div>
      </div>

      <div className="stats-row history-stats">
        <div className="stat-card">
          <div className="stat-icon">📋</div>
          <div className="stat-info">
            <span className="count">{issues.length}</span>
            <span className="label">Total Issues</span>
          </div>
        </div>
      </div>

      <div className="filters-container">
        <div className="filter-group">
          <select
            className="filter-select"
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
          >
            <option disabled>Filter By User</option>
            {uniqueUsers.map(user => (
              <option key={user} value={user}>{user}</option>
            ))}
          </select>

          <select className="filter-select">
            <option disabled>Filter By Item</option>
            <option>All</option>
          </select>
        </div>

        <div className="search-group">
          <div className="search-input-wrapper">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="history-search-input"
            />
          </div>
          <button className="btn-search">Search</button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="history-table-wrapper refined-table">
        <table className="issue-history-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Issuer Name</th>
              <th>Item Name</th>
              <th>Quantity</th>
              <th>Date</th>
              <th>SAP Notification</th>
              <th>Note</th>
              {user?.role === 'admin' && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filteredIssues.length === 0 ? (
              <tr>
                <td colSpan={user?.role === 'admin' ? "8" : "7"} className="no-data" style={{ textAlign: "center" }}>
                  {isLoading ? "Loading data..." : "No records found."}
                </td>
              </tr>
            ) : (
              filteredIssues.map((issue) => editId === issue.id ? (
                <tr key={issue.id} className="edit-row">
                  <td>{issue.type || 'ISSUE'}</td>
                  <td><input name="issued_to" value={editData.issued_to} onChange={handleEditChange} /></td>
                  <td>{issue.item_name}</td>
                  <td><input name="quantity" type="number" value={editData.quantity} onChange={handleEditChange} /></td>
                  <td><input name="issue_date" type="datetime-local" value={editData.issue_date} onChange={handleEditChange} /></td>
                  <td><input name="sap_notification" value={editData.sap_notification || ""} onChange={handleEditChange} /></td>
                  <td><input name="note" value={editData.note || ""} onChange={handleEditChange} /></td>
                  <td>
                    <button className="btn-save-history" onClick={() => handleSave(issue.id)}>Save</button>
                    <button className="btn-cancel-history" onClick={handleCancel}>Cancel</button>
                  </td>
                </tr>
              ) : (
                <tr key={issue.id}>
                  <td>
                    <span className={`status-badge ${issue.type === 'REPLENISH' ? 'success' : 'error'}`}>
                      {issue.type || 'ISSUE'}
                    </span>
                  </td>
                  <td>{issue.issued_to}</td>
                  <td>{issue.item_name}</td>
                  <td className="qty-bubble">{parseInt(issue.quantity, 10)}</td>
                  <td>{new Date(issue.issue_date).toLocaleString()}</td>
                  <td>{issue.sap_notification || "—"}</td>
                  <td>{issue.note || "—"}</td>
                  {user?.role === 'admin' && (
                    <td>
                      <button className="btn-edit-history" onClick={() => handleEdit(issue)}>Edit</button>
                      <button className="btn-delete-history" onClick={() => handleDeleteIssue(issue.id)}>Delete</button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="pagination-footer">
        <button className="page-btn">Previous</button>
        <button className="page-btn active">1</button>
        <button className="page-btn">Next ›</button>
      </div>
    </div>
  );
};

export default IssueHistory;
