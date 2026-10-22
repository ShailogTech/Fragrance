import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const PLACEHOLDER = (label: string, bg = "F4E5A1", fg = "8B1A1A") =>
  `https://placehold.co/600x600/${bg}/${fg}?font=playfair&text=${encodeURIComponent(label)}`;

// Real product-themed images sourced from Wikimedia Commons (probed and confirmed).
const IMG = {
  sandalwood:
    "https://upload.wikimedia.org/wikipedia/commons/0/00/Sandalwood_harvest.jpg",
  sandalwoodPremium:
    "https://upload.wikimedia.org/wikipedia/commons/0/00/Sandalwood_harvest.jpg",
  jasmine:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/JasminumSambac.jpg/960px-JasminumSambac.jpg",
  jasmineDeluxe:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d9/Jasminum_sambac_kz01.jpg/960px-Jasminum_sambac_kz01.jpg",
  rose:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d7/Red_rose_with_black_background.jpg/960px-Red_rose_with_black_background.jpg",
  roseClassic:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/Comestible_rose_in_the_Laquenexy_orchard_garden%2C_Moselle%2C_France_%2801%29.jpg/960px-Comestible_rose_in_the_Laquenexy_orchard_garden%2C_Moselle%2C_France_%2801%29.jpg",
  mogra:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d9/Jasminum_sambac_kz01.jpg/960px-Jasminum_sambac_kz01.jpg",
  temple:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Incense_at_a_wedding_in_South_India.jpg/960px-Incense_at_a_wedding_in_South_India.jpg",
  templePocket:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Incense_at_a_wedding_in_South_India.jpg/960px-Incense_at_a_wedding_in_South_India.jpg",
  kasturi:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/2/21/Incense_in_Vietnam.jpg/960px-Incense_in_Vietnam.jpg",
  oudh:
    "https://upload.wikimedia.org/wikipedia/commons/9/94/Agarwood_top_grade.jpg",
  oudhClassic:
    "https://upload.wikimedia.org/wikipedia/commons/3/33/Highend_Agarwood_Kyara.jpg",
  champa:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/JNU_White_Champa_Flowers.jpg/960px-JNU_White_Champa_Flowers.jpg",
  panchavati:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/2/21/Incense_in_Vietnam.jpg/960px-Incense_in_Vietnam.jpg",
  navagraha:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Incense_at_a_wedding_in_South_India.jpg/960px-Incense_at_a_wedding_in_South_India.jpg",
};

async function main() {
  console.log("🌱 Seeding Shri Fragrance — Agarbatti only...");

  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.address.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();

  // --- Agarbatti only — sub-categories by fragrance ---
  const top = await prisma.category.create({
    data: {
      slug: "agarbatti",
      name: "Agarbatti",
      sortOrder: 1,
      image: PLACEHOLDER("Agarbatti"),
    },
  });

  const subs = [
    { slug: "agarbatti-sandalwood", name: "Sandalwood (Chandan)" },
    { slug: "agarbatti-jasmine", name: "Jasmine (Mallipoo)" },
    { slug: "agarbatti-rose", name: "Rose (Roja)" },
    { slug: "agarbatti-mogra", name: "Mogra" },
    { slug: "agarbatti-temple", name: "Temple Blend" },
    { slug: "agarbatti-kasturi", name: "Kasturi (Musk)" },
    { slug: "agarbatti-oudh", name: "Oudh" },
    { slug: "agarbatti-champa", name: "Champa" },
    { slug: "agarbatti-mixed", name: "Mixed Packs" },
  ];

  const slugToId: Record<string, string> = { agarbatti: top.id };
  for (const s of subs) {
    const sub = await prisma.category.create({
      data: { slug: s.slug, name: s.name, parentId: top.id, sortOrder: 0 },
    });
    slugToId[s.slug] = sub.id;
  }
  console.log(`  ✓ ${Object.keys(slugToId).length} categories`);

  const products = [
    {
      slug: "sandalwood-classic-100g",
      categorySlug: "agarbatti-sandalwood",
      name: "Sandalwood Classic Agarbatti — 100g",
      description:
        "Slow-burning, hand-rolled chandan sticks made from pure sandalwood powder and natural binders. Each stick burns ~40 minutes. Smoke-light, deeply grounding.",
      images: [IMG.sandalwood],
      features: ["Pure chandan", "~40 min burn", "Hand-rolled", "Charcoal-free"],
      price: 180,
      mrp: 220,
      sku: "AGB-SDW-100",
    },
    {
      slug: "sandalwood-premium-200g",
      categorySlug: "agarbatti-sandalwood",
      name: "Sandalwood Premium Agarbatti — 200g",
      description:
        "Premium Mysore-style sandalwood blend. Rich, creamy, long-lasting. The agarbathi for important pooja days.",
      images: [IMG.sandalwoodPremium],
      features: ["Mysore blend", "200g", "Rich aroma"],
      price: 340,
      mrp: 420,
      sku: "AGB-SDW-200",
    },
    {
      slug: "mallipoo-jasmine-50sticks",
      categorySlug: "agarbatti-jasmine",
      name: "Mallipoo Jasmine Agarbatti — 50 sticks",
      description:
        "Fresh jasmine notes captured in slow-burn sticks. Soft, floral, calming — built for evening sandhya.",
      images: [IMG.jasmine],
      features: ["Real jasmine attar", "50 sticks", "Low smoke"],
      price: 120,
      mrp: 150,
      sku: "AGB-MLP-50",
    },
    {
      slug: "mallipoo-deluxe-100g",
      categorySlug: "agarbatti-jasmine",
      name: "Mallipoo Deluxe Agarbatti — 100g",
      description:
        "Deeper jasmine profile with a soft sandal base. Hand-rolled, long-lasting.",
      images: [IMG.jasmineDeluxe],
      features: ["Jasmine + sandal", "Hand-rolled", "100g"],
      price: 200,
      mrp: 240,
      sku: "AGB-MLP-100",
    },
    {
      slug: "roja-rose-premium-200g",
      categorySlug: "agarbatti-rose",
      name: "Roja Rose Premium Agarbatti — 200g",
      description:
        "Premium grade rose attar agarbatti. Full-bodied floral with a warm honey base. Burns clean.",
      images: [IMG.rose],
      features: ["Premium grade", "200g", "Real rose attar"],
      price: 320,
      mrp: 399,
      sku: "AGB-RSE-200",
    },
    {
      slug: "roja-classic-50sticks",
      categorySlug: "agarbatti-rose",
      name: "Roja Classic Agarbatti — 50 sticks",
      description:
        "Everyday rose agarbatti — light, bright, dependable. A pooja-room staple.",
      images: [IMG.roseClassic],
      features: ["Daily-use", "50 sticks", "Bright floral"],
      price: 90,
      mrp: 120,
      sku: "AGB-RSE-50",
    },
    {
      slug: "mogra-deluxe-100g",
      categorySlug: "agarbatti-mogra",
      name: "Mogra Deluxe Agarbatti — 100g",
      description:
        "Sweet white-flower mogra. Crowd favourite for festivals — sweet, lingering, a little heady.",
      images: [IMG.mogra],
      features: ["Hand-rolled", "100g", "Festival favourite"],
      price: 160,
      mrp: 200,
      sku: "AGB-MGR-100",
    },
    {
      slug: "temple-blend-agarbatti-150g",
      categorySlug: "agarbatti-temple",
      name: "Temple Blend Agarbatti — 150g",
      description:
        "Our signature 9-herb blend, modeled on prasadam-room incense of Tamil Nadu temples. Deep, resinous, layered.",
      images: [IMG.temple],
      features: ["9-herb blend", "Long burn", "150g"],
      price: 240,
      mrp: 299,
      sku: "AGB-TMP-150",
    },
    {
      slug: "temple-blend-pocket-25",
      categorySlug: "agarbatti-temple",
      name: "Temple Blend Pocket — 25 sticks",
      description:
        "Travel-size temple blend. Slip into your bag for the puja you do anywhere.",
      images: [IMG.templePocket],
      features: ["25 sticks", "Travel-size", "Same blend"],
      price: 60,
      mrp: 80,
      sku: "AGB-TMP-25",
    },
    {
      slug: "kasturi-special-100g",
      categorySlug: "agarbatti-kasturi",
      name: "Kasturi Special Agarbatti — 100g",
      description:
        "Musk-forward, warm and full. A heritage profile — slow burn for prolonged japa or meditation sessions.",
      images: [IMG.kasturi],
      features: ["Musk profile", "Slow burn", "Meditation-grade"],
      price: 280,
      mrp: 349,
      sku: "AGB-KST-100",
    },
    {
      slug: "oudh-royal-50sticks",
      categorySlug: "agarbatti-oudh",
      name: "Oudh Royal Agarbatti — 50 sticks",
      description:
        "Premium oudh-wood smoke — smoky, resinous, regal. A few sticks fill an entire room.",
      images: [IMG.oudh],
      features: ["Real oudh", "50 sticks", "Premium grade"],
      price: 450,
      mrp: 550,
      sku: "AGB-OUD-50",
    },
    {
      slug: "oudh-classic-100g",
      categorySlug: "agarbatti-oudh",
      name: "Oudh Classic Agarbatti — 100g",
      description:
        "Everyday oudh blend with sandal undertones. Warm, woody, calming.",
      images: [IMG.oudhClassic],
      features: ["Oudh + sandal", "100g", "Warm woody"],
      price: 320,
      mrp: 399,
      sku: "AGB-OUD-100",
    },
    {
      slug: "champa-classic-100g",
      categorySlug: "agarbatti-champa",
      name: "Champa Classic Agarbatti — 100g",
      description:
        "Honey-floral champa — soft, warm, instantly recognisable. The smell of grandmothers' pooja rooms.",
      images: [IMG.champa],
      features: ["Honey-floral", "100g", "Hand-rolled"],
      price: 150,
      mrp: 190,
      sku: "AGB-CMP-100",
    },
    {
      slug: "panchavati-mixed-pack",
      categorySlug: "agarbatti-mixed",
      name: "Panchavati Five-Fragrance Pack",
      description:
        "Sandalwood, jasmine, rose, mogra, and temple blend — 20 sticks of each in a single gift box. Perfect to discover or gift.",
      images: [IMG.panchavati],
      features: ["5 fragrances", "100 sticks total", "Gift-ready box"],
      price: 499,
      mrp: 650,
      sku: "AGB-PNC-100",
    },
    {
      slug: "navagraha-nine-pack",
      categorySlug: "agarbatti-mixed",
      name: "Navagraha Nine-Fragrance Set",
      description:
        "Nine sub-fragrances — one for each graha. A connoisseur's gift. 18 sticks each, packed in a teak-finish box.",
      images: [IMG.navagraha],
      features: ["9 fragrances", "162 sticks", "Teak-finish box"],
      price: 1199,
      mrp: 1499,
      sku: "AGB-NVG-9",
    },
  ];

  for (const p of products) {
    await prisma.product.create({
      data: {
        slug: p.slug,
        categoryId: slugToId[p.categorySlug],
        name: p.name,
        description: p.description,
        images: JSON.stringify(p.images),
        features: JSON.stringify(p.features),
        price: p.price,
        mrp: p.mrp,
        stock: 100,
        sku: p.sku,
      },
    });
  }
  console.log(`  ✓ ${products.length} products`);

  await prisma.user.createMany({
    data: [
      {
        email: "admin@shri.com",
        passwordHash: await bcrypt.hash("admin@1234", 12),
        name: "Shri Admin",
        role: "Admin",
      },
      {
        email: "customer@shri.local",
        passwordHash: await bcrypt.hash("customer123", 12),
        name: "Demo Customer",
        role: "Customer",
      },
    ],
  });
  console.log("  ✓ 2 demo accounts");
  console.log("✓ Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
