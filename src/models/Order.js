const mongoose = require("mongoose"); 
const cargoSchema = new mongoose.Schema(
{
    addaName: String,
    contact: String,
    builtyNo: String,
    addaKharcha: Number,
    address: String
},
{
    _id: false
});

const paymentSchema = new mongoose.Schema(
{
    id: String,

    amt: Number,

    method: String,

    receipt_img: String,

    at: Number
},
{
    _id: false
});

const orderItemSchema = new mongoose.Schema(
{
    id: String,

    product_id: String,

    title_en: String,

    title_ur: {
        type: String,
        default: ""
    },

    qty: {
        type: Number,
        default: 1
    },

    unit_price: Number,

    custom:{
        type: Number,
        default: null
    },

    line_total: Number
},
{
    _id: false
});


const orderSchema = new mongoose.Schema(
{
    _id: String,

    bill_type: {
        type: String,
        default: "Walkin"
    },

    status: {
        type: String,
        default: "new"
    },

    customer: {
        type: String,
        required: true
    },

    phone: {
        type: String,
        default: ""
    },

    city: {
        type: String,
        default: ""
    },

    payment: {
        type: String,
        default: ""
    },

    notes: {
        type: String,
        default: ""
    },

    cargo: cargoSchema,

    subtotal: {
        type: Number,
        default: 0
    },

    discount: {
        type: Number,
        default: 0
    },

    total: {
        type: Number,
        default: 0
    },

    items: {
        type: [orderItemSchema],
        default: []
    },

    payments: {
        type: [paymentSchema],
        default: []
    },

    created_at: Number,

    updated_at: Number
},
{
    versionKey: false
});

orderSchema.index({ status: 1 });
orderSchema.index({ bill_type: 1 });
orderSchema.index({ updated_at: -1 });

orderSchema.virtual("id").get(function () {
    return this._id;
});

orderSchema.set("toJSON", {
  virtuals: true,
});

orderSchema.set("toObject", {
  virtuals: true,
});
module.exports = mongoose.model("Order", orderSchema);