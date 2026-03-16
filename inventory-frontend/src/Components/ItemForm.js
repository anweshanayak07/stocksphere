import React, { useState } from "react";

function ItemForm({ onAdd, uniqueCategories = [], uniqueLocations = [] }) {
    const [formData, setFormData] = useState({
        name: "",
        make: "",
        material_code: "",
        quantity: "",
        location: "",
        category: "",
        min_quantity: ""
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.name.trim()) return alert("Item name is required");
        onAdd(formData);
        setFormData({
            name: "",
            make: "",
            material_code: "",
            quantity: "",
            location: "",
            category: "",
            min_quantity: ""
        });
    };

    return (
        <form className="item-form" onSubmit={handleSubmit}>
            <input name="name" type="text" placeholder="Item Name" value={formData.name} onChange={handleChange} required />
            <input name="make" type="text" placeholder="Make" value={formData.make} onChange={handleChange} />
            <input name="material_code" type="text" placeholder="Material Code" value={formData.material_code} onChange={handleChange} />
            <input name="quantity" placeholder="Quantity" type="number" min={0} value={formData.quantity} onChange={handleChange} />

            <input
                name="location"
                placeholder="Location"
                value={formData.location}
                onChange={handleChange}
                list="location-options"
            />
            <datalist id="location-options">
                {uniqueLocations.map((loc, index) => (
                    <option key={index} value={loc} />
                ))}
            </datalist>

            <input
                name="category"
                placeholder="Category"
                type="text"
                value={formData.category}
                onChange={handleChange}
                list="category-options"
            />
            <datalist id="category-options">
                {uniqueCategories.map((cat, index) => (
                    <option key={index} value={cat} />
                ))}
            </datalist>

            <input name="min_quantity" placeholder="Min Qty" type="number" min={0} value={formData.min_quantity} onChange={handleChange} />
            <button className="btn-primary" type="submit">+ Add New Item</button>
        </form>
    );
}
export default ItemForm;
