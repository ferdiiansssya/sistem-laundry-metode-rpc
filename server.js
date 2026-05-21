const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const BASE_PRICE = 5000;
const EXTRA_SETRIKA = 3000;
const EXTRA_LIPAT = 4000;

let orders = [];
let nextIdNum = 1;

function generateOrderId() {
    return `ORD-${String(nextIdNum++).padStart(3, '0')}`;
}

function calculateTotal(weight, setrika, lipat) {
    if (!weight || weight <= 0) return 0;
    let pricePerKg = BASE_PRICE;
    if (setrika) pricePerKg += EXTRA_SETRIKA;
    if (lipat) pricePerKg += EXTRA_LIPAT;
    return weight * pricePerKg;
}

app.post('/rpc', (req, res) => {
    const { jsonrpc, method, params, id } = req.body;

    if (jsonrpc !== '2.0') {
        return res.status(400).json({ error: 'Invalid JSON-RPC version' });
    }

    const sendResponse = (result, error = null) => {
        res.json({ jsonrpc: '2.0', result, error, id });
    };

    if (method === 'listOrders') {
        const orderList = orders.map(o => ({
            id: o.id,
            address: o.address,
            weight: o.weight,
            setrika: o.setrika,
            lipat: o.lipat,
            total: o.total,
            status: o.status,
            pickupDate: o.pickupDate,
            note: o.note,
        }));
        return sendResponse(orderList);
    }

    if (method === 'createOrder') {
        const { address, setrika, lipat, pickupDate, note } = params;

        if (!address || address.trim() === '') {
            return sendResponse(null, { code: -32602, message: 'Alamat jemput harus diisi' });
        }
        if (!pickupDate) {
            return sendResponse(null, { code: -32602, message: 'Tanggal jemput harus diisi' });
        }

        const newOrder = {
            id: generateOrderId(),
            address,
            weight: null,
            setrika: setrika || false,
            lipat: lipat || false,
            total: 0,
            status: 'menunggu',
            createdAt: new Date().toISOString(),
            pickupDate,
            note: note || '',
        };

        orders.unshift(newOrder);
        return sendResponse({
            id: newOrder.id,
            total: 0,
            status: newOrder.status,
        });
    }

    if (method === 'updateWeight') {
        const { orderId, weight } = params;

        const order = orders.find(o => o.id === orderId);
        if (!order) {
            return sendResponse(null, { code: -32602, message: 'Order tidak ditemukan' });
        }
        if (!weight || weight <= 0 || weight > 100) {
            return sendResponse(null, { code: -32602, message: 'Berat harus antara 1-100 kg' });
        }

        order.weight = weight;
        order.total = calculateTotal(weight, order.setrika, order.lipat);
        if (order.status === 'menunggu') order.status = 'proses';

        return sendResponse({ success: true, total: order.total, status: order.status });
    }

    sendResponse(null, { code: -32601, message: 'Method not found' });
});

app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/rpc')) {
        return res.sendFile(path.join(__dirname, 'index.html'));
    }
    next();
});

app.listen(PORT, () => {
    console.log(`✅ Laundry RPC Server running at http://localhost:${PORT}`);
});