import React, { useEffect, useState } from "react";
import { fetchApi, ApiError } from "../../api/client.js";
import { formatINR } from "@brightloop/shared";
import { Button } from "../../components/ui/Button.js";
import { Input } from "../../components/ui/Input.js";
import { Badge } from "../../components/ui/Badge.js";
import { Package, Plus, Sparkles, Tag, Layers, X, Search } from "lucide-react";

interface Variant {
  id?: number;
  name?: string;
  attribute: string;
  value: string;
  priceAdjustment: number;
}

interface Product {
  id: number;
  name: string;
  type: "service" | "software" | "addon" | "physical";
  salesPrice: number;
  costPrice: number;
  notes?: string;
  isActive: boolean;
  variants: Variant[];
  createdAt: string;
}

export function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  // New Product Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<"software" | "service" | "addon" | "physical">("software");
  const [salesPrice, setSalesPrice] = useState("1500");
  const [costPrice, setCostPrice] = useState("500");
  const [notes, setNotes] = useState("");
  const [variants, setVariants] = useState<Variant[]>([
    { attribute: "Brand", value: "Odoo", priceAdjustment: 560 },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadProducts = async () => {
    setIsLoading(true);
    try {
      const data = await fetchApi<Product[]>("/products");
      setProducts(data);
    } catch (err) {
      console.error("Failed to load products", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const handleAddVariant = () => {
    setVariants([...variants, { attribute: "Edition", value: "Enterprise", priceAdjustment: 0 }]);
  };

  const handleRemoveVariant = (index: number) => {
    setVariants(variants.filter((_, i) => i !== index));
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await fetchApi("/products", {
        method: "POST",
        body: JSON.stringify({
          name,
          type,
          salesPrice: parseFloat(salesPrice),
          costPrice: parseFloat(costPrice),
          notes,
          variants: variants.map((v) => ({
            name: `${v.attribute}: ${v.value}`,
            attribute: v.attribute,
            value: v.value,
            priceAdjustment: Number(v.priceAdjustment),
          })),
        }),
      });

      setIsModalOpen(false);
      setName("");
      setNotes("");
      loadProducts();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to create product");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-subtle pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl sm:text-3xl font-medium text-text-primary">
              Products & Variants
            </h1>
            <Badge variant="active">{products.length} Products</Badge>
          </div>
          <p className="text-sm text-text-secondary mt-1">
            Manage your service and software catalog with dynamic variant pricing adjustments.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={() => setIsModalOpen(true)}
          className="self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          <span>New Product</span>
        </Button>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Search products by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-surface-card border border-border-default rounded-sm focus:outline-none focus:border-brand-forest focus:ring-1 focus:ring-brand-forest text-text-primary"
          />
        </div>
      </div>

      {/* Products Table */}
      {isLoading ? (
        <div className="p-12 text-center text-text-secondary text-sm animate-pulse">
          Loading products catalog...
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-surface-card border border-border-default rounded-lg p-12 text-center flex flex-col items-center gap-3">
          <Package className="w-10 h-10 text-brand-forest/60" />
          <div className="text-base font-semibold text-text-primary">No products found</div>
          <p className="text-xs text-text-secondary max-w-sm">
            Get started by adding your first subscription product or software package.
          </p>
          <Button variant="primary" size="sm" onClick={() => setIsModalOpen(true)}>
            Create First Product
          </Button>
        </div>
      ) : (
        <div className="bg-surface-card border border-border-default rounded-lg overflow-hidden shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-page border-b border-border-subtle text-xs uppercase tracking-wider text-text-secondary font-semibold">
                <tr>
                  <th className="py-3.5 px-4 sm:px-6">Product</th>
                  <th className="py-3.5 px-4">Type</th>
                  <th className="py-3.5 px-4">Base Sales Price</th>
                  <th className="py-3.5 px-4">Cost Price</th>
                  <th className="py-3.5 px-4">Configured Variants</th>
                  <th className="py-3.5 px-4 sm:px-6">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-brand-creamSoft/40 transition-colors">
                    <td className="py-4 px-4 sm:px-6">
                      <div className="font-semibold text-text-primary">{product.name}</div>
                      {product.notes && (
                        <div className="text-xs text-text-secondary mt-0.5 line-clamp-1">
                          {product.notes}
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium uppercase tracking-wide bg-brand-creamDeep text-brand-forest border border-brand-taupe/40">
                        {product.type}
                      </span>
                    </td>
                    <td className="py-4 px-4 font-mono font-medium text-text-primary">
                      {formatINR(product.salesPrice)}
                    </td>
                    <td className="py-4 px-4 font-mono text-text-secondary text-xs">
                      {formatINR(product.costPrice)}
                    </td>
                    <td className="py-4 px-4">
                      {product.variants.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {product.variants.map((v, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono bg-surface-page border border-border-subtle text-text-primary"
                            >
                              <span>{v.name || `${v.attribute}: ${v.value}`}</span>
                              {v.priceAdjustment > 0 && (
                                <span className="font-semibold text-brand-forest">
                                  (+{formatINR(v.priceAdjustment)})
                                </span>
                              )}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-text-muted italic">Standard only</span>
                      )}
                    </td>
                    <td className="py-4 px-4 sm:px-6">
                      <Badge variant="active">Active</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto">
          <div className="bg-surface-card border border-border-default rounded-lg max-w-xl w-full p-6 shadow-modal flex flex-col gap-5 my-8">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-brand-forest" />
                <h3 className="font-display text-xl font-medium text-text-primary">
                  Create New Product
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-text-muted hover:text-text-primary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="p-3 bg-semantic-dangerBg border border-semantic-danger/30 text-semantic-danger text-xs rounded-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateProduct} className="flex flex-col gap-4">
              <Input
                label="Product Name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Odoo Connector Service or Cloud Subscription"
              />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    Product Type
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm bg-surface-card border border-border-default rounded-sm text-text-primary focus:outline-none focus:border-brand-forest"
                  >
                    <option value="software">Software</option>
                    <option value="service">Service</option>
                    <option value="addon">Add-on</option>
                    <option value="physical">Physical</option>
                  </select>
                </div>

                <Input
                  label="Sales Price (₹)"
                  type="number"
                  required
                  step="0.01"
                  value={salesPrice}
                  onChange={(e) => setSalesPrice(e.target.value)}
                />

                <Input
                  label="Cost Price (₹)"
                  type="number"
                  step="0.01"
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value)}
                />
              </div>

              <Input
                label="Description & Internal Notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Operational notes, SLA terms, or technical details"
              />

              {/* Variants Section */}
              <div className="border-t border-border-subtle pt-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                    Product Variants (e.g. Odoo variant adds ₹560.00)
                  </span>
                  <button
                    type="button"
                    onClick={handleAddVariant}
                    className="text-xs text-brand-forest font-semibold hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Variant</span>
                  </button>
                </div>

                {variants.map((v, index) => (
                  <div
                    key={index}
                    className="p-3 bg-surface-page border border-border-subtle rounded-sm grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end"
                  >
                    <div className="sm:col-span-4">
                      <Input
                        label="Attribute"
                        value={v.attribute}
                        onChange={(e) => {
                          const updated = [...variants];
                          updated[index].attribute = e.target.value;
                          setVariants(updated);
                        }}
                        placeholder="Brand"
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <Input
                        label="Value"
                        value={v.value}
                        onChange={(e) => {
                          const updated = [...variants];
                          updated[index].value = e.target.value;
                          setVariants(updated);
                        }}
                        placeholder="Odoo"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <Input
                        label="Price Adj (₹)"
                        type="number"
                        value={v.priceAdjustment}
                        onChange={(e) => {
                          const updated = [...variants];
                          updated[index].priceAdjustment = parseFloat(e.target.value) || 0;
                          setVariants(updated);
                        }}
                      />
                    </div>
                    <div className="sm:col-span-1 flex justify-center pb-2">
                      <button
                        type="button"
                        onClick={() => handleRemoveVariant(index)}
                        className="text-text-muted hover:text-semantic-danger"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3 border-t border-border-subtle pt-4 mt-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="md" isLoading={isSubmitting}>
                  Save Product
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
