import React, { useState } from "react";
import './IssueModal.css'; // Reusing IssueModal styles for consistency

function ReplenishModal({ item, onClose, onReplenish }) {
    const [replenishQty, setReplenishQty] = useState("");
    const [note, setNote] = useState("Stock Replenishment");

    const handleSubmit = (e) => {
        e.preventDefault();
        const qty = Number(replenishQty);

        if (!replenishQty || isNaN(qty) || qty <= 0) {
            return alert("Please enter a valid quantity.");
        }

        onReplenish(item.id, qty, note);
        onClose();
    };

    return (
        <div className="modal">
            <div className="modal-container">
                <h3>Replenish Stock: {item.name}</h3>
                <div style={{ marginBottom: '15px', color: '#666', fontSize: '0.9rem' }}>
                    Current Quantity: <strong>{item.quantity}</strong>
                </div>

                <form onSubmit={handleSubmit}>
                    <input
                        type="number"
                        placeholder="Quantity to add"
                        value={replenishQty}
                        onChange={(e) => setReplenishQty(e.target.value)}
                        autoFocus
                    />

                    <textarea
                        placeholder="Note (Optional)"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        rows="2"
                        style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ddd', marginBottom: '15px' }}
                    />

                    <div className="modal-actions">
                        <button className="confirm" type="submit" style={{ backgroundColor: '#38a169' }}>Confirm Replenish</button>
                        <button className="cancel" type="button" onClick={onClose}>Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default ReplenishModal;
