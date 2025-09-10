import Product from "../Models/product.model.js"
import { redis } from "../lib/redis.js"
import cloudinary from "../lib/cloudinary.js"

const BASE_URL = process.env.BASE_URL || "http://localhost:5000";

// 🔧 Helper: format product image into full URL
function formatProductImage(product) {
    const obj = product.toObject ? product.toObject() : product;
    if (obj.image && !obj.image.startsWith("http")) {
        obj.image = `${BASE_URL}${obj.image}`;
    }
    return obj;
}

export const getAllproducts = async (req, res) => {
    try {
        const products = await Product.find({});
        const formatted = products.map(formatProductImage);
        res.json({ products: formatted });
    } catch (error) {
        console.log("Error in getAllProducts controller", error.message);
        res.status(500).json({ message: "server error", error: error.message });
    }
};

export const getFeaturedproducts = async (req, res) => {
    try {
        let featuredProducts = await redis.get("featured_products");
        if (featuredProducts) {
            return res.json(JSON.parse(featuredProducts));
        }

        featuredProducts = await Product.find({ isFeatured: true }).lean();
        if (!featuredProducts) {
            return res.status(404).json({ message: "no featured product found" });
        }

        featuredProducts = featuredProducts.map(formatProductImage);

        await redis.set("featured_products", JSON.stringify(featuredProducts));
        res.json(featuredProducts);
    } catch (error) {
        console.log("Error in getFeaturedProducts controller", error.message);
        res.status(500).json({ message: "server error", error: error.message });
    }
};

export const createProduct = async (req, res) => {
    try {
        const { name, description, price, category, image } = req.body;
        let cloudinaryResponse = null;

        if (image) {
            cloudinaryResponse = await cloudinary.uploader.upload(image, { folder: "products" });
        }

        const product = await Product.create({
            name,
            description,
            price,
            category,
            image: cloudinaryResponse?.secure_url
                ? cloudinaryResponse.secure_url
                : image.startsWith("/uploads/")
                ? image
                : ""
        });

        res.status(201).json(formatProductImage(product));
    } catch (error) {
        console.log("Error in createProduct controller", error.message);
        return res.status(500).json({ message: "server error", error: error.message });
    }
};

export const deleteProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ message: "product not found" });
        }

        if (product.image && product.image.includes("cloudinary")) {
            const publicId = product.image.split("/").pop().split(".")[0];
            try {
                await cloudinary.uploader.destroy(`products/${publicId}`);
                console.log("Deleted from Cloudinary");
            } catch (error) {
                console.log("Cloudinary delete error", error.message);
            }
        }

        await Product.findByIdAndDelete(req.params.id);
        res.json({ message: "product deleted successfully" });
    } catch (error) {
        console.log("Error in deleteProduct controller", error.message);
        res.status(500).json({ message: "server error", error: error.message });
    }
};

export const getRecommendationProducts = async (req, res) => {
    try {
        let products = await Product.aggregate([
            { $sample: { size: 4 } },
            {
                $project: {
                    _id: 1,
                    name: 1,
                    description: 1,
                    image: 1,
                    price: 1
                }
            }
        ]);

        products = products.map(formatProductImage);
        res.json(products);
    } catch (error) {
        console.log("Error in getRecommendationProducts", error.message);
        res.status(500).json({ message: "server error", error: error.message });
    }
};

export const getproductsByCategory = async (req, res) => {
    const { category } = req.params;
    try {
        const products = await Product.find({ category });
        const formatted = products.map(formatProductImage);
        res.json({ products: formatted });
    } catch (error) {
        console.log("Error in getProductsByCategory", error.message);
        res.status(500).json({ message: "server error", error: error.message });
    }
};

export const toggleFeaturedProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (product) {
            product.isFeatured = !product.isFeatured;
            const updatedProduct = await product.save();
            await updateFeaturedProductsCache();
            res.json(formatProductImage(updatedProduct));
        } else {
            res.status(404).json({ message: "product not found" });
        }
    } catch (error) {
        console.log("Error in toggleFeaturedProduct", error.message);
        res.status(500).json({ message: "server error", error: error.message });
    }
};

async function updateFeaturedProductsCache() {
    try {
        let featuredProducts = await Product.find({ isFeatured: true }).lean();
        featuredProducts = featuredProducts.map(formatProductImage);
        await redis.set("featured_products", JSON.stringify(featuredProducts));
    } catch (error) {
        console.log("Error in updateFeaturedProductsCache", error.message);
    }
}
