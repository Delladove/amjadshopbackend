const mongoose = require("mongoose"); 

const productSchema = new mongoose.Schema(
{
    _id: String,

    cat_id: {
        type: String,
        ref: "Category",
        required: true
    },

    title_en: {
        type: String,
        required: true
    },

    title_ur: {
        type: String,
        default: ""
    },

    unit_price: {
        type: Number,
        default: 0
    },

    barcode: {
        type: String,
        unique: true,
        sparse: true
    },

    img: String,

    imgs: {
        type: [String],
        default: []
    },

    shared: {
        type: Boolean,
        default: false
    },

    share_count: {
        type: Number,
        default: 0
    },

    created_at: Number
},
{
    versionKey: false
});

productSchema.index({ cat_id: 1 });
// productSchema.index({ barcode: 1 });
productSchema.virtual("id").get(function () {
    return this._id;
});

productSchema.set("toJSON", {
  virtuals: true,
});


productSchema.set("toObject", {
  virtuals: true,
});
module.exports = mongoose.model("Product", productSchema);