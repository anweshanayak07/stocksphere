import React, { useState } from "react";
import './IssueModal.css';


function IssueModal({ item, onClose, onIssue }) {
    const [issuedQty, setIssuedQty] = useState("");
    const [issuerName, setIssuerName] = useState("");
    const [sapNotification, setSapNotification] = useState("");
    const [note, setNote] = useState("");
    const [issueDate, setIssueDate] = useState(() => {
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        return now.toISOString().slice(0, 16);
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        const qty = Number(issuedQty);
        if (!issuedQty || !issuerName || isNaN(qty) || qty <= 0) {
            return alert("All fields required!");
        }
        onIssue(item.id, qty, issuerName, sapNotification, note, issueDate);
        onClose();
    };

    return (
        <div className="modal">
            <div className="modal-container">
                <h3>Issue Item: {item.name}</h3>
                <form onSubmit={handleSubmit}>
                    <input
                        type="text"
                        placeholder="Your name"
                        value={issuerName}
                        onChange={(e) => setIssuerName(e.target.value)}
                    />
                    <input
                        type="number"
                        placeholder="Quantity"
                        value={issuedQty}
                        onChange={(e) => setIssuedQty(e.target.value)}
                    />
                    <input
                        type="text"
                        placeholder="SAP Notification"
                        value={sapNotification}
                        onChange={(e) => setSapNotification(e.target.value)}
                    />
                    <textarea
                        placeholder="Note"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        rows="3"
                        style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ddd', marginBottom: '15px' }}
                    />
                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#666', marginBottom: '5px' }}>Issue Date & Time</label>
                        <input
                            type="datetime-local"
                            value={issueDate}
                            onChange={(e) => setIssueDate(e.target.value)}
                            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                        />
                    </div>
                    <div className="modal-actions">
                        <button className="confirm" type="submit">Confirm</button>
                        <button className="cancel" type="button" onClick={onClose}>Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
export default IssueModal;