import React, { useEffect, useState } from "react";
import './App.css';
import ItemForm from "./Components/ItemForm";
import ItemList from "./Components/ItemList";
import IssueModal from "./Components/IssueModal";
import ReplenishModal from "./Components/ReplenishModal";
import IssueHistory from "./Pages/IssueHistory";
import Login from "./Pages/Login";
import api from "./api";
import logo from './assets/logo.PNG';

function App() {
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({ totalItems: 0, itemsIssued: 0 });
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedLocation, setSelectedLocation] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [uniqueCategories, setUniqueCategories] = useState([]);
  const [uniqueLocations, setUniqueLocations] = useState([]);
  const [user, setUser] = useState(() => {
    const savedUsername = localStorage.getItem("username");
    const savedRole = localStorage.getItem("role");
    return {
      username: savedUsername || "Guest",
      role: savedRole || "guest"
    };
  });
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showReplenishModal, setShowReplenishModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [recentIssues, setRecentIssues] = useState([]); // Kept for potential future use or if needed by IssueHistory prop
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [view, setView] = useState("dashboard");
  const [showLoginModal, setShowLoginModal] = useState(false);

  const itemsPerPage = 20;

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchItems = async (pageArg, searchArg, categoryArg, locationArg, statusArg) => {
    const page = pageArg !== undefined ? pageArg : currentPage;
    const search = searchArg !== undefined ? searchArg : searchTerm;
    const category = categoryArg !== undefined ? categoryArg : selectedCategory;
    const location = locationArg !== undefined ? locationArg : selectedLocation;
    const status = statusArg !== undefined ? statusArg : selectedStatus;

    setIsLoading(true);
    try {
      const query = new URLSearchParams({
        page,
        limit: itemsPerPage,
        search,
        category,
        location,
        status
      });
      const response = await api.get(`/api/items?${query.toString()}`);
      setItems(response.data.data || []);
      setTotalPages(response.data.totalPages || 1);
    } catch (err) {
      showToast("Error fetching items", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDashboardData = async () => {
    try {
      const [statsRes, historyRes] = await Promise.all([
        api.get("/api/dashboard/stats"),
        api.get("/api/issues?limit=5")
      ]);
      setStats(statsRes.data);
      setRecentIssues(historyRes.data.data || []);
    } catch (err) {
      console.error("Dashboard error:", err);
    }
  };

  const fetchFilterOptions = async () => {
    try {
      const [locsRes, catsRes] = await Promise.all([
        api.get("/api/items/locations"),
        api.get("/api/items/categories")
      ]);
      setUniqueLocations(locsRes.data);
      setUniqueCategories(catsRes.data);
    } catch (err) {
      console.error("Error fetching filter options:", err);
    }
  };

  useEffect(() => {
    fetchItems();
    fetchDashboardData();
  }, [currentPage, selectedCategory, selectedLocation, selectedStatus]);

  useEffect(() => {
    fetchFilterOptions();
  }, []);

  const handleAddItem = async (newItem) => {
    try {
      await api.post("/api/items", newItem);
      showToast("Item added successfully");
      fetchItems(currentPage);
      fetchDashboardData();
    } catch (err) {
      showToast(err.response?.data?.error || "Error adding item", "error");
    }
  };

  const handleDeleteItem = async (id) => {
    if (!window.confirm("Are you sure you want to delete this item?")) return;
    try {
      await api.delete(`/api/items/${id}`);
      showToast("Item deleted");
      fetchItems(currentPage);
      fetchDashboardData();
    } catch (err) {
      showToast("Error deleting item", "error");
    }
  };

  const handleUpdateItem = async (updatedItem) => {
    try {
      await api.put(`/api/items/${updatedItem.id}`, updatedItem);
      showToast("Item updated");
      fetchItems(currentPage);
    } catch (err) {
      showToast("Update failed", "error");
    }
  };

  const handleIssueItem = (item) => {
    setSelectedItem(item);
    setShowIssueModal(true);
  };

  const handleReplenishItem = (item) => {
    setSelectedItem(item);
    setShowReplenishModal(true);
  };

  const handleIssueConfirm = async (itemId, qty, issuerName, sapNotification, note, issueDate) => {
    try {
      await api.post("/api/issues", {
        item_id: itemId,
        quantity: qty,
        issued_to: issuerName,
        sap_notification: sapNotification,
        note: note,
        issue_date: issueDate,
        type: 'ISSUE'
      });
      showToast(`Successfully issued ${qty} items`);
      fetchItems(currentPage);
      fetchDashboardData();
    } catch (err) {
      showToast(err.response?.data?.error || "Issuance failed", "error");
    }
  };

  const handleReplenishConfirm = async (itemId, qty, note) => {
    try {
      await api.post("/api/issues", {
        item_id: itemId,
        quantity: qty,
        issued_to: user.username,
        sap_notification: "",
        note: note,
        type: 'REPLENISH'
      });
      showToast(`Successfully replenished ${qty} items`);
      fetchItems(currentPage);
      fetchDashboardData();
    } catch (err) {
      showToast(err.response?.data?.error || "Replenish failed", "error");
    }
  };

  const escapeCSVValue = (val) => {
    if (val === null || val === undefined) return "";
    const str = String(val);
    if (str.includes(",") || str.includes("\"") || str.includes("\n") || str.includes("\r")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const exportToCSV = () => {
    const headers = ["ID", "Name", "Make", "Material Code", "Quantity", "Location", "Category"];
    const rows = items.map(i => [
      i.id,
      i.name,
      i.make,
      i.material_code,
      i.quantity,
      i.location,
      i.category
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(r => r.map(escapeCSVValue).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `stocksphere_report_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="dashboard-wrapper">
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.message}
        </div>
      )}

      <nav className="navbar">
        <div className="nav-brand">
          <img src={logo} alt="StockSphere Logo" className="nav-logo" />
        </div>
        <div className="nav-links">
          <a
            href="#"
            className={view === 'dashboard' ? 'active' : ''}
            onClick={(e) => { e.preventDefault(); setView('dashboard'); }}
          >
            Dashboard
          </a>
          <a
            href="#"
            className={view === 'issueHistory' ? 'active' : ''}
            onClick={(e) => { e.preventDefault(); setView('issueHistory'); }}
          >
            History
          </a>
          <button className="logout-btn" onClick={() => setShowLoginModal(true)}>Login</button>
          <button className="logout-btn" onClick={() => { localStorage.clear(); window.location.reload(); }}>Logout</button>
        </div>
      </nav>

      <div className="app-container">
        {view === 'dashboard' ? (
          <>
            <div className="dashboard-header">
              <h1>StockSphere Dashboard</h1>
              <div className="user-welcome">Welcome, {user.username} ({user.role})</div>
            </div>

            <div className="stats-row">
              <div className="stat-card" onClick={() => setView('dashboard')} style={{ cursor: 'pointer' }}>
                <div className="stat-icon">📦</div>
                <div className="stat-info">
                  <span className="count">{stats.totalItems}</span>
                  <span className="label">Total Items</span>
                </div>
              </div>

              <div className="stat-card" onClick={() => setView('issueHistory')} style={{ cursor: 'pointer' }}>
                <div className="stat-icon">📤</div>
                <div className="stat-info">
                  <span className="count">{stats.itemsIssued}</span>
                  <span className="label">Items Issued (View History)</span>
                </div>
              </div>
            </div>

            <section className="inventory-section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 className="section-title">Current Inventory</h2>
                {isLoading && <span className="loading-tag">Updating...</span>}
              </div>

              <div className="search-container">
                <div />
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    className="search-input"
                    type="text"
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      if (e.target.value === "") {
                        setCurrentPage(1);
                        fetchItems(1, "");
                      }
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && fetchItems(1, searchTerm)}
                  />
                  <button className="btn-primary" onClick={() => fetchItems(1, searchTerm)}>Search</button>
                  {(searchTerm || selectedCategory !== "All" || selectedStatus !== "All") && (
                    <button className="btn-outline" onClick={() => {
                      setSearchTerm("");
                      setSelectedCategory("All");
                      setSelectedLocation("All");
                      setSelectedStatus("All");
                      setCurrentPage(1);
                      fetchItems(1, "", "All", "All", "All");
                    }}>Clear Filters</button>
                  )}
                </div>
              </div>

              {user.role === 'admin' && <ItemForm
                onAdd={handleAddItem}
                uniqueCategories={uniqueCategories}
                uniqueLocations={uniqueLocations}
              />}

              <ItemList
                items={items}
                onDelete={handleDeleteItem}
                onUpdate={handleUpdateItem}
                onIssue={handleIssueItem}
                onReplenish={handleReplenishItem}
                searchTerm={searchTerm}
                userRole={user.role}
                selectedCategory={selectedCategory}
                selectedLocation={selectedLocation}
                selectedStatus={selectedStatus}
                uniqueCategories={uniqueCategories}
                uniqueLocations={uniqueLocations}
                onCategoryFilter={(cat) => {
                  setSelectedCategory(cat);
                  setCurrentPage(1);
                }}
                onLocationFilter={(loc) => {
                  setSelectedLocation(loc);
                  setCurrentPage(1);
                }}
                onStatusFilter={(status) => {
                  setSelectedStatus(status);
                  setCurrentPage(1);
                }}
              />

              <div className="pagination">
                <button disabled={currentPage === 1} onClick={() => setCurrentPage(1)}>First</button>
                <button disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)}>Prev</button>
                <span className="page-info">Page {currentPage} of {totalPages}</span>
                <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(currentPage + 1)}>Next</button>
                <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(totalPages)}>Last</button>
              </div>
            </section>
          </>
        ) : (
          <IssueHistory user={user} />
        )}
      </div>

      {showIssueModal && (
        <IssueModal
          item={selectedItem}
          onClose={() => setShowIssueModal(false)}
          onIssue={handleIssueConfirm}
        />
      )}

      {showReplenishModal && (
        <ReplenishModal
          item={selectedItem}
          onClose={() => setShowReplenishModal(false)}
          onReplenish={handleReplenishConfirm}
        />
      )}

      {showLoginModal && (
        <div className="modal-overlay" onClick={() => setShowLoginModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <Login setUser={(u) => {
              setUser(u);
              setShowLoginModal(false);
            }} />
            <button className="btn-close-modal" onClick={() => setShowLoginModal(false)}>×</button>
          </div>
        </div>
      )}
      <footer className="footer">
        <p>&copy; {new Date().getFullYear()} StockSphere. All rights reserved. Developed by Anwesha Nayak</p>
      </footer>
    </div>
  );
}

export default App;
