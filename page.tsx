
"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AppControls, useApp } from "@/components/app-provider";

type Category = {
  id: string;
  name: string;
  sort_order: number;
};

type Food = {
  id: string;
  name: string;
  categoryId: string | null;
  category: string;
  price: number;
  description: string;
  imageUrl: string | null;
  isAvailable: boolean;
};

type CartItem = {
  food: Food;
  quantity: number;
};

type TrackedOrder = {
  order_number: string;
  status: string;
  total_amount: number;
  created_at: string;
  estimated_ready_at: string | null;
  items: { food_name: string; unit_price: number; quantity: number }[];
};

export default function Home() {
  const [supabase] = useState(() => createClient());
  const { language, direction, t } = useApp();
  const locale = language === "fa" ? "fa-IR" : "en-US";

  const [categories, setCategories] = useState<Category[]>([]);
  const [foods, setFoods] = useState<Food[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [selectedCategory, setSelectedCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [menuFilter, setMenuFilter] = useState<"all" | "available" | "favorites">("all");
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [favoritesReady, setFavoritesReady] = useState(false);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [clubOpen, setClubOpen] = useState(false);
  const [clubPhone, setClubPhone] = useState("");
  const [clubMessage, setClubMessage] = useState("");
  const [clubSubmitting, setClubSubmitting] = useState(false);
  const [customerNote, setCustomerNote] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [orderSubmitted, setOrderSubmitted] = useState(false);
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // اطلاعات مشتری و آخرین سفارش فقط در همین مرورگر نگهداری می‌شود.
  const [trackOpen, setTrackOpen] = useState(false);
  const [trackedOrder, setTrackedOrder] = useState<TrackedOrder | null>(null);
  const [trackLoading, setTrackLoading] = useState(false);
  const [trackError, setTrackError] = useState("");
  const [savedOrderNumber, setSavedOrderNumber] = useState("");
  const [savedTrackingToken, setSavedTrackingToken] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");

  // راهنمای انتخاب غذا؛ پاسخ‌ها فقط در حافظه همین صفحه نگهداری می‌شوند.
  const [foodQuizOpen, setFoodQuizOpen] = useState(false);
  const [foodQuizStep, setFoodQuizStep] = useState(0);
  const [foodQuizAnswers, setFoodQuizAnswers] = useState({
    hunger: "",
    craving: "",
    budget: "",
    taste: "",
  });

  // فقط در اولین بازدید خودکار نمایش داده می‌شود؛ رد کردن آن برای بازدیدهای بعدی ذخیره می‌شود.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      if (localStorage.getItem("general_food_quiz_dismissed") !== "yes") {
        timer = setTimeout(() => setFoodQuizOpen(true), 900);
      }
    } catch {
      timer = setTimeout(() => setFoodQuizOpen(true), 900);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, []);

  function dismissFoodQuiz() {
    setFoodQuizOpen(false);
    try {
      localStorage.setItem("general_food_quiz_dismissed", "yes");
    } catch (error) {
      console.warn("Could not save food quiz preference:", error);
    }
  }

  function openFoodQuiz() {
    setFoodQuizStep(0);
    setFoodQuizAnswers({ hunger: "", craving: "", budget: "", taste: "" });
    setFoodQuizOpen(true);
  }

  function getFoodQuizRecommendations() {
    const available = foods.filter((food) => food.isAvailable);
    if (available.length === 0) return [];

    const sortedPrices = available.map((food) => food.price).sort((a, b) => a - b);
    const medianPrice = sortedPrices[Math.floor(sortedPrices.length / 2)] ?? 0;
    const upperPrice = sortedPrices[Math.floor((sortedPrices.length - 1) * 0.75)] ?? medianPrice;

    const hasAny = (value: string, words: string[]) =>
      words.some((word) => value.includes(word));

    return available
      .map((food) => {
        const text = `${food.name} ${food.category} ${food.description}`.toLocaleLowerCase(
          language === "fa" ? "fa-IR" : "en-US"
        );
        let score = 0;

        if (foodQuizAnswers.craving && foodQuizAnswers.craving !== "any") {
          const groups: Record<string, string[]> = {
            burger: ["برگر", "burger", "همبرگر"],
            pizza: ["پیتزا", "pizza"],
            sandwich: ["ساندویچ", "هات داگ", "hot dog", "sandwich", "هات‌داگ"],
            fried: ["سوخاری", "مرغ", "chicken", "fried"],
          };
          if (hasAny(text, groups[foodQuizAnswers.craving] ?? [])) score += 5;
        }

        if (foodQuizAnswers.hunger === "light" &&
            hasAny(text, ["پیش غذا", "پیش‌غذا", "سیب زمینی", "ناگت", "اسنک", "fries", "snack", "nugget"])) score += 3;
        if (foodQuizAnswers.hunger === "very" &&
            hasAny(text, ["دبل", "دوبل", "ویژه", "مخصوص", "بزرگ", "پرملات", "double", "large", "special", "loaded"])) score += 3;
        if (foodQuizAnswers.hunger === "group" &&
            hasAny(text, ["خانواده", "خانوادگی", "دونفره", "چندنفره", "پیتزا", "کمبو", "سینی", "family", "combo", "sharing", "pizza"])) score += 4;

        if (foodQuizAnswers.budget === "low" && food.price <= medianPrice) score += 2;
        if (foodQuizAnswers.budget === "mid" && food.price <= upperPrice) score += 2;

        if (foodQuizAnswers.taste === "spicy" &&
            hasAny(text, ["تند", "فلفل", "اسپایسی", "چیلی", "spicy", "chili", "pepper"])) score += 3;
        if (foodQuizAnswers.taste === "cheesy" &&
            hasAny(text, ["پنیر", "چیز", "موزارلا", "cheese", "cheesy", "mozzarella"])) score += 3;
        if (foodQuizAnswers.taste === "meaty" &&
            hasAny(text, ["گوشت", "بیف", "مرغ", "استیک", "میکس", "beef", "meat", "steak", "chicken"])) score += 3;

        return { food, score };
      })
      .sort((a, b) => b.score - a.score || a.food.price - b.food.price)
      .slice(0, 3)
      .map((item) => item.food);
  }

  useEffect(() => {
    try {
      const savedName = localStorage.getItem("foodflow_customer_name") ?? "";
      const savedToken = localStorage.getItem("foodflow_tracking_token") ?? "";
      const savedNumber = localStorage.getItem("foodflow_last_order_number") ?? "";
      setCustomerName(savedName);
      setSavedTrackingToken(savedToken);
      setSavedOrderNumber(savedNumber);
    } catch (error) {
      console.warn("Could not restore customer details:", error);
    }
  }, []);

  // علاقه‌مندی‌ها در همین مرورگر ذخیره می‌شوند.
  useEffect(() => {
    try {
      const savedFavorites = localStorage.getItem("foodflow_favorite_foods");
      if (savedFavorites) {
        const parsed: unknown = JSON.parse(savedFavorites);
        if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
          setFavoriteIds(parsed);
        }
      }
    } catch (error) {
      console.warn("Could not restore favorite foods:", error);
    } finally {
      setFavoritesReady(true);
    }
  }, []);

  useEffect(() => {
    if (!favoritesReady) return;
    try {
      localStorage.setItem("foodflow_favorite_foods", JSON.stringify(favoriteIds));
    } catch (error) {
      console.warn("Could not save favorite foods:", error);
    }
  }, [favoriteIds, favoritesReady]);

  function formatPrice(price: number) {
    return (
      new Intl.NumberFormat(locale).format(price) +
      (language === "fa" ? " تومان" : " toman")
    );
  }

  useEffect(() => {
    let cancelled = false;

    async function loadMenu() {
      setLoading(true);
      setLoadError("");

      try {
        const { data: restaurant, error: restaurantError } =
          await supabase
            .from("restaurants")
            .select("id")
            .eq("name", "فست فود ژنرال")
            .single();

        if (restaurantError) throw restaurantError;
        if (!restaurant) throw new Error("Restaurant not found");

        const { data: categoryData, error: categoryError } =
          await supabase
            .from("categories")
            .select("id, name, sort_order")
            .eq("restaurant_id", restaurant.id)
            .eq("is_active", true)
            .order("sort_order", { ascending: true });

        if (categoryError) throw categoryError;

        const { data: foodData, error: foodError } =
          await supabase
            .from("foods")
            .select(
              "id, name, category_id, price, description, image_url, is_available"
            )
            .eq("restaurant_id", restaurant.id)
            .eq("is_active", true)
            .order("created_at", { ascending: false });

        if (foodError) throw foodError;
        if (cancelled) return;

        const loadedCategories = (categoryData ?? []) as Category[];

        const categoryMap = new Map(
          loadedCategories.map((category) => [
            category.id,
            category.name,
          ])
        );

        const loadedFoods: Food[] = (foodData ?? []).map((food) => ({
          id: food.id,
          name: food.name,
          categoryId: food.category_id,
          category:
            categoryMap.get(food.category_id) ??
            (language === "fa" ? "بدون دسته‌بندی" : "Uncategorized"),
          price: Number(food.price),
          description: food.description ?? "",
          imageUrl: food.image_url,
          isAvailable: food.is_available,
        }));

        setCategories(loadedCategories);
        setFoods(loadedFoods);
      } catch (error) {
        console.error("Menu loading error:", error);

        if (!cancelled) {
          setLoadError(
            t(
              "دریافت منو با مشکل مواجه شد. اتصال دیتابیس را بررسی کن.",
              "Could not load the menu. Please check the database connection."
            )
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadMenu();

    return () => {
      cancelled = true;
    };
  }, [supabase, language, t]);

  const filteredFoods = useMemo(() => {
    const query = search.trim().toLocaleLowerCase(
      language === "fa" ? "fa-IR" : "en-US"
    );

    return foods.filter((food) => {
      const matchesCategory =
        selectedCategory === "all" || food.category === selectedCategory;
      const searchableText = [food.name, food.description, food.category]
        .join(" ")
        .toLocaleLowerCase(language === "fa" ? "fa-IR" : "en-US");
      const matchesSearch = !query || searchableText.includes(query);
      const matchesAvailability =
        menuFilter !== "available" || food.isAvailable;
      const matchesFavorites =
        menuFilter !== "favorites" || favoriteIds.includes(food.id);

      return matchesCategory && matchesSearch && matchesAvailability && matchesFavorites;
    });
  }, [foods, selectedCategory, search, menuFilter, favoriteIds, language]);

  const cartCount = cartItems.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  const totalPrice = cartItems.reduce(
    (sum, item) => sum + item.food.price * item.quantity,
    0
  );

  function toggleFavorite(foodId: string) {
    setFavoriteIds((current) =>
      current.includes(foodId)
        ? current.filter((id) => id !== foodId)
        : [...current, foodId]
    );
  }

  function surpriseMe() {
    const availableFoods = foods.filter((food) => food.isAvailable);
    if (availableFoods.length === 0) return;
    const chosenFood = availableFoods[Math.floor(Math.random() * availableFoods.length)];
    setSelectedCategory("all");
    setMenuFilter("all");
    setSearch(chosenFood.name);
    document.getElementById("street-menu")?.scrollIntoView({ behavior: "smooth" });
  }

  function addToCart(food: Food) {
    if (!food.isAvailable) return;

    setCartItems((currentItems) => {
      const existingItem = currentItems.find(
        (item) => item.food.id === food.id
      );

      if (existingItem) {
        return currentItems.map((item) =>
          item.food.id === food.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [...currentItems, { food, quantity: 1 }];
    });

    setCartOpen(true);
  }

  function decreaseQuantity(foodId: string) {
    setCartItems((currentItems) =>
      currentItems
        .map((item) =>
          item.food.id === foodId
            ? { ...item, quantity: item.quantity - 1 }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  async function submitOrder() {
    if (isSubmitting) return;

    setFormError("");

    if (!customerName.trim()) {
      setFormError(t("نام خود را وارد کن.", "Please enter your name."));
      return;
    }

    if (cartItems.length === 0) {
      setFormError(t("سبد خرید خالی است.", "Your cart is empty."));
      return;
    }

    if (cartItems.some((item) => !item.food.isAvailable)) {
      setFormError(
        t("یکی از غذاهای سفارش موجود نیست.", "An item is unavailable.")
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const items = cartItems.map((item) => ({
        id: item.food.id,
        quantity: item.quantity,
      }));

      const { data, error } = await supabase.rpc(
        "create_foodflow_order",
        {
          p_customer_name: customerName.trim(),
          p_customer_phone: null,
          p_customer_note: customerNote.trim(),
          p_items: items,
          p_table_id: null,
        }
      );

      if (error) throw error;

      const result = data as {
        success?: boolean;
        order_number?: string;
        tracking_token?: string;
      };

      if (!result?.success || !result.order_number || !result.tracking_token) {
        throw new Error("Invalid order response: missing tracking credentials");
      }

      setOrderNumber(result.order_number);
      setSavedOrderNumber(result.order_number);
      setSavedTrackingToken(result.tracking_token);
      try {
        localStorage.setItem("foodflow_customer_name", customerName.trim());
        localStorage.setItem("foodflow_last_order_number", result.order_number);
        localStorage.setItem("foodflow_tracking_token", result.tracking_token);
        localStorage.removeItem("foodflow_customer_phone");
      } catch (storageError) {
        console.warn("Could not save order details in this browser:", storageError);
      }
      setOrderSubmitted(true);
    } catch (error: unknown) {
      console.error("Order submission failed:", error);

      setFormError(
        error instanceof Error
          ? error.message
          : t("خطا در ثبت سفارش.", "Order submission failed.")
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function resetOrder() {
    setCartItems([]);
    setCustomerNote("");
    setOrderNumber("");
    setOrderSubmitted(false);
    setCheckoutOpen(false);
    setCartOpen(false);
    setFormError("");
  }

  async function fetchTrackedOrder() {
    if (!savedOrderNumber || !savedTrackingToken) {
      setTrackError(
        t(
          "هنوز سفارشی در این مرورگر ثبت نشده است. ابتدا سفارش خود را ثبت کن.",
          "No saved order was found in this browser. Please place an order first."
        )
      );
      return;
    }

    setTrackLoading(true);
    setTrackError("");
    try {
      const { data, error } = await supabase.rpc("track_foodflow_order", {
        p_order_number: savedOrderNumber,
        p_tracking_token: savedTrackingToken,
      });

      if (error) throw error;
      if (!data) {
        setTrackedOrder(null);
        setTrackError(
          t("سفارشی با اطلاعات ذخیره‌شده پیدا نشد.", "No order was found.")
        );
        return;
      }

      setTrackedOrder(data as TrackedOrder);
      setLastUpdated(new Date().toLocaleTimeString(locale));
    } catch (error) {
      console.error("Order tracking failed:", error);
      setTrackError(
        t("دریافت وضعیت سفارش با مشکل مواجه شد. دوباره تلاش کن.", "Could not load order status. Please try again.")
      );
    } finally {
      setTrackLoading(false);
    }
  }

  useEffect(() => {
    if (!trackOpen || !savedOrderNumber || !savedTrackingToken) return;

    void fetchTrackedOrder();
    const timer = window.setInterval(() => {
      void fetchTrackedOrder();
    }, 10000);

    return () => window.clearInterval(timer);
    // fetchTrackedOrder intentionally uses the saved order credentials.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackOpen, savedOrderNumber, savedTrackingToken]);

  function formatDateTime(value: string | null) {
    if (!value) return "";
    return new Date(value).toLocaleString(locale, {
      hour: "2-digit",
      minute: "2-digit",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  function statusLabel(status: string) {
    const labels: Record<string, string> = {
      Pending: t("در انتظار تأیید", "Pending"),
      Preparing: t("در حال آماده‌سازی", "Preparing"),
      Ready: t("آماده تحویل", "Ready"),
      Completed: t("تکمیل‌شده", "Completed"),
      Delivered: t("تحویل‌شده", "Delivered"),
      Cancelled: t("لغوشده", "Cancelled"),
    };
    return labels[status] ?? status;
  }

  const redButton =
    "bg-[#7d2030] text-white shadow-lg shadow-[#7d2030]/20 transition duration-300 hover:-translate-y-0.5 hover:bg-[#e8492d] active:translate-y-0";

  const panel =
    "border border-[#e8dfd4] bg-white shadow-[0_16px_50px_rgba(54,35,25,0.06)]";

  const gold = "text-[#a77b35]";

  return (
    <main
      dir={direction}
      className="min-h-screen overflow-hidden bg-[#f3eee7] text-[#211916] selection:bg-[#7d2030] selection:text-white"
    >
      <style jsx global>{`
        @import url("https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700;800;900&display=swap");
        body { background: #f3eee7; font-family: "Vazirmatn", sans-serif; }
        .ff-display { font-family: Georgia, "Times New Roman", serif; letter-spacing: -.055em; }
        .ff-card { transition: transform .35s ease, box-shadow .35s ease; }
        .ff-card:hover { transform: translateY(-9px); box-shadow: 0 28px 70px rgba(20,10,7,.28); }
        .ff-card img { transition: transform .65s cubic-bezier(.2,.8,.2,1); }
        .ff-card:hover img { transform: scale(1.07); }
        .ff-scroll::-webkit-scrollbar { height: 4px; }
        .ff-scroll::-webkit-scrollbar-thumb { background: #9b4652; border-radius: 20px; }
        .ff-reveal { animation: ff-reveal .7s cubic-bezier(.2,.8,.2,1) both; }
        @keyframes ff-reveal { from { opacity:0; transform:translateY(22px); } to { opacity:1; transform:translateY(0); } }
        .ff-header { border-color:rgba(20,20,20,.12)!important; }
        .ff-header a img { border-radius:14px!important; background:#151515; padding:4px; }
        .ff-hero { isolation:isolate; }
        .ff-hero:before { content:""; position:absolute; inset:0; z-index:-1; opacity:.32; background-image:linear-gradient(rgba(255,255,255,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.045) 1px,transparent 1px); background-size:54px 54px; mask-image:linear-gradient(90deg,black,transparent 90%); }
        .ff-hero:after { content:"G"; position:absolute; z-index:-1; right:-.04em; bottom:-.42em; color:rgba(255,255,255,.035); font:900 clamp(22rem,48vw,55rem)/.8 Arial,sans-serif; letter-spacing:-.12em; pointer-events:none; }
        .ff-hero h2 { text-wrap:balance; }
        .ff-hero-image { transform:rotate(2deg); transition:transform .7s cubic-bezier(.2,.8,.2,1),box-shadow .7s; }
        .ff-hero-image:hover { transform:rotate(0) scale(1.025); box-shadow:0 45px 110px rgba(0,0,0,.7); }
        .ff-hero-image img { filter:saturate(1.12) contrast(1.06); }
        .ff-menu-card { border:1px solid rgba(255,255,255,.1)!important; border-radius:1.15rem!important; background:#f9f6ef!important; color:#171717!important; box-shadow:0 18px 50px rgba(25,20,15,.08)!important; }
        .ff-menu-card:hover { transform:translateY(-8px) rotate(-.25deg); box-shadow:0 28px 70px rgba(25,20,15,.16)!important; }
        .ff-menu-card > div:first-child { background:#ded8cc!important; min-height:270px; }
        .ff-menu-card > div:first-child img { transition:transform .8s cubic-bezier(.2,.8,.2,1),filter .8s; }
        .ff-menu-card:hover > div:first-child img { transform:scale(1.09); filter:saturate(1.16); }
        .ff-menu-card > div:nth-child(2) h3 { color:#171717!important; font-size:clamp(1.25rem,2vw,1.7rem); letter-spacing:-.045em; }
        .ff-menu-card > div:nth-child(2) p { color:#77736c!important; }
        .ff-menu-card > div:nth-child(2) > div:last-child { border-color:rgba(20,20,20,.12)!important; }
        .ff-menu-card > div:nth-child(2) > div:last-child p { color:#171717!important; }
        .ff-menu-card > div:nth-child(2) > div:last-child p:last-child { color:#c9472c!important; }
        .ff-menu-card > div:first-child span { letter-spacing:.08em; }
        #street-menu { scroll-margin-top:100px; }
        #street-menu h2 { letter-spacing:-.065em; }
        @media(min-width:1024px) { .ff-hero h2 { font-size:clamp(5.5rem,8vw,8.5rem)!important; } }
        @media(max-width:640px) { .ff-hero { margin-inline:-1rem; } .ff-hero-image { width:94%; } .ff-menu-card > div:first-child { min-height:230px; } }
        /* GENERAL / CLASSIC MODERN THEME */
        :root {
          --g-ink: #302823;
          --g-paper: #f8f4ec;
          --g-green: #781f35;
          --g-green-soft: #f1e5e3;
          --g-orange: #a77b35;
          --g-muted: #75695f;
        }
        body, main {
          background: var(--g-paper) !important;
          color: var(--g-ink) !important;
          font-family: "Vazirmatn", sans-serif;
        }
        .ff-header {
          background: rgba(248,244,236,.97) !important;
          color: var(--g-ink) !important;
          border-color: #e5d9c9 !important;
          box-shadow: 0 5px 24px rgba(56,38,25,.07);
        }
        .ff-header nav { color: #51463e !important; }
        .ff-header nav a:hover { color: #781f35 !important; }
        .ff-brand { text-decoration: none; }
        .ff-logo-mark {
          width: 54px; height: 54px; flex: 0 0 54px;
          display: grid; place-items: center;
          border: 2px solid #c49a55; border-radius: 17px;
          background: linear-gradient(145deg,#8b2942,#501323);
          box-shadow: 0 5px 14px #781f3525;
        }
        .ff-logo-mark span { color: #f2dcae; font: 900 34px/1 Georgia,serif; }
        .ff-brand-caption { display:block; color:#a77b35; font-size:9px; font-weight:900; letter-spacing:.16em; }
        .ff-brand-title { display:block; color:#302823; font-size:19px; font-weight:900; white-space:nowrap; }
        .ff-header-action {
          display:inline-flex; align-items:center; justify-content:center; gap:8px;
          min-height:44px; padding:10px 19px;
          border:1px solid #781f3540 !important; border-radius:999px !important;
          background:#fffdf9 !important; color:#781f35 !important;
          font-size:12px; font-weight:900; box-shadow:0 4px 12px #3826190b !important;
        }
        .ff-header-action:hover {
          background:#781f35 !important; border-color:#781f35 !important;
          color:white !important; transform:translateY(-2px);
          box-shadow:0 8px 18px #781f3530 !important;
        }
        .ff-header-action span { color:#b58a48; font-size:17px; }
        .ff-header-action:hover span { color:#f2dcae; }
        .ff-nav-link { padding:11px 17px; color:#51463e; font-size:13px; font-weight:800; text-decoration:none; transition:.25s ease; }
        .ff-cart-button {
          min-height:46px; padding:11px 21px; border:0 !important; border-radius:999px !important;
          background:linear-gradient(135deg,#8b2942,#501323) !important; color:white !important;
          font-size:13px; font-weight:900; box-shadow:0 7px 18px #781f3530 !important;
        }
        .ff-cart-button:hover { background:#681a30 !important; transform:translateY(-2px); }
        @media(max-width:767px) {
          .ff-logo-mark { width:45px; height:45px; flex-basis:45px; border-radius:14px; }
          .ff-logo-mark span { font-size:29px; }
          .ff-brand-title { font-size:16px; }
          .ff-brand-caption { font-size:8px; }
          .ff-header-nav { padding-top:8px; border-top:1px solid #e5d9c9; }
          .ff-header-action { min-height:40px; padding:9px 13px; font-size:11px; }
          .ff-nav-link { padding:9px 12px; font-size:12px; }
          .ff-cart-button { min-height:42px; padding:9px 13px; font-size:11px; }
        }
        .ff-hero {
          margin: 20px 0 0 !important;
          min-height: 650px !important;
          border: 0 !important;
          border-radius: 30px !important;
          background: #203d32 !important;
          box-shadow: 0 24px 65px rgba(32,61,50,.16) !important;
        }
        .ff-hero:before {
          opacity: .16 !important;
          background-size: 48px 48px !important;
          background-image: linear-gradient(rgba(255,255,255,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.08) 1px,transparent 1px) !important;
        }
        .ff-hero:after {
          content: "G" !important;
          right: -.02em !important;
          bottom: -.35em !important;
          color: rgba(255,255,255,.035) !important;
          font: 900 clamp(22rem,48vw,54rem)/.8 Georgia,serif !important;
          letter-spacing: -.12em !important;
        }
        .ff-hero > div:first-child {
          background: radial-gradient(ellipse at 78% 40%,rgba(230,107,69,.24),transparent 40%),radial-gradient(ellipse at 5% 100%,rgba(190,215,177,.13),transparent 42%) !important;
        }
        .ff-hero .relative.grid { min-height: 630px !important; }
        .ff-hero .inline-flex {
          border: 1px solid rgba(241,205,157,.35) !important;
          background: rgba(241,205,157,.1) !important;
          color: #f1cd9d !important;
          border-radius: 999px !important;
          letter-spacing: .12em !important;
        }
        .ff-hero h2 {
          font-family: "Vazirmatn",sans-serif !important;
          font-weight: 900 !important;
          letter-spacing: -.065em !important;
          line-height: 1.02 !important;
          text-transform: none !important;
        }
        .ff-hero h2 span:first-of-type { color: #f08a64 !important; }
        .ff-hero h2 span:last-of-type { color: #f7f5ef !important; }
        .ff-hero p { color: rgba(247,245,239,.72) !important; }
        .ff-hero button:first-child {
          background: var(--g-orange) !important;
          color: white !important;
          border-radius: 999px !important;
          box-shadow: 0 10px 25px rgba(230,107,69,.24) !important;
        }
        .ff-hero button:first-child:hover { background: #f0805b !important; }
        .ff-hero button:nth-child(2) {
          border-radius: 999px !important;
          border-color: rgba(255,255,255,.28) !important;
        }
        .ff-hero-image {
          border-radius: 28px !important;
          border: 7px solid rgba(255,255,255,.13) !important;
          box-shadow: 0 28px 70px rgba(0,0,0,.32) !important;
          transform: rotate(1deg) !important;
        }
        .ff-hero-image:hover { transform: rotate(0) scale(1.02) !important; }
        .ff-hero-image > div:last-child {
          background: linear-gradient(0deg,rgba(16,30,24,.78),transparent 68%) !important;
        }
        .ff-hero-image p:first-child { color: #f1cd9d !important; }
        .ff-hero > div:last-child {
          background: #e9b77f !important;
          color: #263b30 !important;
          letter-spacing: .14em !important;
        }
        #street-menu {
          margin: 0 -3rem !important;
          padding: 90px 3rem 105px !important;
          background: var(--g-paper) !important;
          color: var(--g-ink) !important;
        }
        #street-menu h2 {
          color: var(--g-ink) !important;
          font-size: clamp(2.5rem,5vw,4.8rem) !important;
          font-weight: 900 !important;
          letter-spacing: -.07em !important;
          line-height: 1.08 !important;
        }
        #street-menu h2 span { color: var(--g-orange) !important; }
        #street-menu p { color: var(--g-muted) !important; }
        #street-menu input {
          background: #fff !important;
          border: 1px solid #e4e5dc !important;
          color: #202923 !important;
          border-radius: 16px !important;
          box-shadow: 0 5px 18px rgba(32,41,35,.04) !important;
        }
        #street-menu input::placeholder { color: #9a9e96 !important; }
        #street-menu input:focus {
          border-color: #789581 !important;
          box-shadow: 0 0 0 4px rgba(36,75,59,.09) !important;
        }
        #street-menu .ff-scroll button {
          border-radius: 999px !important;
          text-transform: none !important;
          letter-spacing: 0 !important;
        }
        #street-menu .ff-scroll button[class*="bg-[#211916]"] {
          background: var(--g-green) !important;
          color: white !important;
        }
        #street-menu .ff-scroll button:not([class*="bg-[#211916]"]) {
          background: white !important;
          color: #657168 !important;
          border-color: #e2e5dc !important;
        }
        #street-menu > div > div:nth-child(3) { border-color: #e1e5dc !important; }
        #street-menu > div > div:nth-child(3) span { color: var(--g-orange) !important; }
        .ff-menu-card {
          background: #fff !important;
          color: var(--g-ink) !important;
          border: 1px solid #ecece5 !important;
          border-radius: 22px !important;
          box-shadow: 0 8px 28px rgba(32,41,35,.055) !important;
        }
        .ff-menu-card:hover {
          transform: translateY(-6px) !important;
          border-color: #d5e0d5 !important;
          box-shadow: 0 20px 42px rgba(32,41,35,.11) !important;
        }
        .ff-menu-card > div:first-child {
          background: #edf0e9 !important;
          min-height: 260px !important;
        }
        .ff-menu-card > div:first-child img { filter: saturate(1.04) contrast(1.02) !important; }
        .ff-menu-card > div:nth-child(2) h3 {
          color: var(--g-ink) !important;
          font-size: clamp(1.2rem,2vw,1.55rem) !important;
          font-weight: 850 !important;
          letter-spacing: -.045em !important;
        }
        .ff-menu-card > div:nth-child(2) p { color: #7b827b !important; }
        .ff-menu-card > div:nth-child(2) > div:first-child { color: var(--g-orange) !important; }
        .ff-menu-card > div:nth-child(2) > div:last-child { border-color: #eceee8 !important; }
        .ff-menu-card > div:nth-child(2) > div:last-child p { color: var(--g-ink) !important; }
        .ff-menu-card > div:nth-child(2) > div:last-child p:last-child {
          color: var(--g-green) !important;
          font-size: 1.12rem !important;
        }
        .ff-menu-card button {
          border-radius: 999px !important;
          background: var(--g-green) !important;
          color: white !important;
          box-shadow: none !important;
        }
        .ff-menu-card button:hover { background: var(--g-orange) !important; color: white !important; }
        #street-menu .rounded-\[2rem\] { border-radius: 22px !important; }
        footer {
          background: #203d32 !important;
          color: var(--g-paper) !important;
          border-color: rgba(255,255,255,.12) !important;
        }
        footer h3 span { color: #f08a64 !important; }
        @media(min-width:1024px) {
          .ff-hero h2 { font-size: clamp(5.3rem,7.5vw,7.8rem) !important; }
        }
        @media(max-width:767px) {
          .ff-hero { margin: 0 -1rem !important; border-radius: 0 !important; }
          .ff-hero .relative.grid { min-height: auto !important; }
          #street-menu { margin-inline: -1rem !important; padding: 65px 1rem 75px !important; }
          .ff-hero h2 { font-size: clamp(3.1rem,13vw,5rem) !important; }
          .ff-hero-image { width: 88% !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          *,*::before,*::after { animation-duration:.01ms!important; transition-duration:.01ms!important; }
        }

        /* ===== RESPONSIVE MOBILE REFINEMENT ===== */
        :root {
          --line: #e5d9c9;
          --gold: #c49a55;
          color-scheme: light;
        }
        html { scroll-behavior: smooth; }
        body { min-width: 320px; }
        button, a { -webkit-tap-highlight-color: transparent; }
        button:focus-visible, a:focus-visible, input:focus-visible, textarea:focus-visible, select:focus-visible {
          outline: 3px solid rgba(196,154,85,.65) !important;
          outline-offset: 3px !important;
        }
        .ff-header { z-index: 50; }
        .ff-header > div { min-height: 76px; }
        .ff-header-action, .ff-cart-button { min-height: 44px; }
        .ff-hero button, #street-menu button { touch-action: manipulation; }
        .ff-menu-card { min-width: 0; }
        .ff-menu-card img { display:block; }
        .ff-menu-card button { min-width: 44px; min-height: 44px; }

        @media (max-width: 767px) {
          .ff-header > div {
            display: flex !important;
            flex-wrap: wrap !important;
            align-items: center !important;
            justify-content: space-between !important;
            gap: 9px 10px !important;
            padding: 9px 12px !important;
          }
          .ff-brand { gap: 8px !important; max-width: 48%; }
          .ff-logo-mark { width: 42px !important; height: 42px !important; flex-basis: 42px !important; border-radius: 13px !important; }
          .ff-logo-mark span { font-size: 27px !important; }
          .ff-brand-caption { font-size: 7px !important; letter-spacing: .1em !important; }
          .ff-brand-title { font-size: 14px !important; }
          .ff-header > div > div:last-child { gap: 6px !important; }
          .ff-header > div > div:last-child > div { gap: 5px !important; }
          .ff-header > div > div:last-child button {
            min-width: 39px !important; min-height: 39px !important;
            padding: 7px 9px !important; border-radius: 13px !important;
            font-size: 12px !important;
          }
          .ff-cart-button { min-height: 40px !important; padding: 8px 12px !important; font-size: 11px !important; }
          .ff-header-nav {
            order: 3 !important; width: 100% !important;
            display: flex !important; justify-content: center !important;
            gap: 7px !important; padding-top: 8px !important;
            border-top: 1px solid #e5d9c9 !important;
          }
          .ff-nav-link { padding: 8px 12px !important; font-size: 12px !important; }
          .ff-header-action { min-height: 38px !important; padding: 8px 12px !important; font-size: 11px !important; }

          .ff-hero { margin: 0 -1rem !important; border-radius: 0 0 24px 24px !important; min-height: 0 !important; }
          .ff-hero .relative.grid {
            min-height: 0 !important; gap: 24px !important;
            padding: 42px 20px 34px !important;
          }
          .ff-hero h2 {
            font-size: clamp(2.65rem, 11vw, 4.1rem) !important;
            line-height: 1.2 !important; letter-spacing: -.055em !important;
          }
          .ff-hero p { font-size: 14px !important; line-height: 1.95 !important; }
          .ff-hero .ff-hero-image { width: min(82%, 330px) !important; margin-inline: auto !important; }
          .ff-hero .relative.grid > div:first-child > div:last-child { gap: 10px !important; margin-top: 22px !important; }
          .ff-hero .relative.grid > div:first-child > div:last-child button,
          .ff-hero .relative.grid > div:first-child > div:last-child a {
            min-height: 48px !important; padding: 11px 17px !important; font-size: 13px !important;
          }
          #street-menu { margin-inline: -1rem !important; padding: 46px 14px 64px !important; }
          #street-menu h2 { font-size: clamp(2rem, 8vw, 3rem) !important; }
          #street-menu .ff-scroll { gap: 8px !important; padding-bottom: 5px !important; }
          #street-menu .ff-scroll button { min-height: 42px !important; padding: 9px 15px !important; font-size: 12px !important; }
          .ff-menu-card { border-radius: 18px !important; }
          .ff-menu-card > div:first-child { min-height: 0 !important; height: clamp(175px, 53vw, 225px) !important; }
          .ff-menu-card > div:nth-child(2) { padding: 16px !important; }
          .ff-menu-card > div:nth-child(2) h3 { font-size: 1.2rem !important; }
          .ff-menu-card button { min-height: 42px !important; }
          .fixed.bottom-5.start-5 { bottom: 14px !important; inset-inline-start: 12px !important; padding: 11px 15px !important; font-size: 12px !important; z-index: 35 !important; }
          .fixed.inset-0 > section { max-height: calc(100dvh - 24px) !important; overflow-y: auto !important; }
          footer { padding-top: 34px !important; padding-bottom: 34px !important; }
        }
        @media (max-width: 380px) {
          .ff-brand-caption { display: none !important; }
          .ff-brand-title { font-size: 13px !important; }
          .ff-header-action { padding-inline: 9px !important; font-size: 10px !important; }
          .ff-cart-button { padding-inline: 10px !important; }
        }

        /* ===== DARK THEME: charcoal, white and restrained gold ===== */
        html.dark { color-scheme: dark; --line: #49433c; --gold: #d3ad6c; }
        html.dark body, html.dark main {
          background: #111111 !important; color: #f4f0e9 !important;
        }
        html.dark .ff-header {
          background: rgba(24,24,24,.97) !important;
          color: #f4f0e9 !important; border-color: #3a3530 !important;
          box-shadow: 0 5px 24px rgba(0,0,0,.35) !important;
        }
        html.dark .ff-brand-title, html.dark .ff-header nav,
        html.dark .ff-nav-link { color: #f4f0e9 !important; }
        html.dark .ff-brand-caption { color: #d3ad6c !important; }
        html.dark .ff-header-nav { border-color: #3a3530 !important; }
        html.dark .ff-header-action {
          background: #242424 !important; color: #f4f0e9 !important;
          border-color: #645137 !important; box-shadow: none !important;
        }
        html.dark .ff-header-action:hover { background: #3a3022 !important; color: #f7dfb0 !important; }
        html.dark .ff-cart-button { background: linear-gradient(135deg,#3b3b3b,#171717) !important; color: #f7dfb0 !important; border: 1px solid #8d7044 !important; }
        html.dark .ff-logo-mark { background: linear-gradient(145deg,#333,#111) !important; border-color: #c49a55 !important; }
        html.dark .ff-logo-mark span { color: #f1d59e !important; }

        html.dark .ff-hero {
          background: #191919 !important;
          box-shadow: 0 24px 65px rgba(0,0,0,.4) !important;
        }
        html.dark .ff-hero > div:first-child {
          background: radial-gradient(ellipse at 78% 40%,rgba(196,154,85,.16),transparent 42%),radial-gradient(ellipse at 5% 100%,rgba(255,255,255,.06),transparent 42%) !important;
        }
        html.dark .ff-hero h2 span:first-of-type { color: #e0bd7c !important; }
        html.dark .ff-hero h2 span:last-of-type,
        html.dark .ff-hero p { color: #f2eee7 !important; }
        html.dark .ff-hero .inline-flex { color: #e6c98f !important; border-color: #8b7048 !important; background: #29251f !important; }
        html.dark .ff-hero button:first-child { background: #f0eee9 !important; color: #171717 !important; box-shadow: 0 8px 22px #0008 !important; }
        html.dark .ff-hero button:nth-child(2) { color: #f4f0e9 !important; border-color: #777 !important; background: #252525 !important; }

        html.dark #street-menu { background: #111111 !important; color: #f4f0e9 !important; }
        html.dark #street-menu h2, html.dark #street-menu h3 { color: #f4f0e9 !important; }
        html.dark #street-menu p { color: #c5beb3 !important; }
        html.dark #street-menu h2 span { color: #d3ad6c !important; }
        html.dark #street-menu input,
        html.dark input, html.dark textarea, html.dark select {
          background: #242424 !important; color: #ffffff !important;
          border-color: #51483c !important; caret-color: #e1bd7c !important;
        }
        html.dark input::placeholder, html.dark textarea::placeholder { color: #bdb4a8 !important; opacity: 1 !important; }
        html.dark #street-menu .ff-scroll button {
          background: #242424 !important; color: #e9e4dc !important; border-color: #51483c !important;
        }
        html.dark #street-menu .ff-scroll button[class*="bg-[#211916]"] {
          background: #d3ad6c !important; color: #17130e !important; border-color: #d3ad6c !important;
        }
        html.dark .ff-menu-card {
          background: #222222 !important; color: #f4f0e9 !important;
          border-color: #3c3832 !important; box-shadow: 0 12px 32px #0007 !important;
        }
        html.dark .ff-menu-card > div:first-child { background: #34302b !important; }
        html.dark .ff-menu-card > div:nth-child(2) h3,
        html.dark .ff-menu-card > div:nth-child(2) > div:last-child p { color: #f4f0e9 !important; }
        html.dark .ff-menu-card > div:nth-child(2) p { color: #c4bbae !important; }
        html.dark .ff-menu-card > div:nth-child(2) > div:last-child { border-color: #49433b !important; }
        html.dark .ff-menu-card > div:nth-child(2) > div:last-child p:last-child { color: #e0bd7c !important; }
        html.dark .ff-menu-card button { background: #f0eee9 !important; color: #171717 !important; }

        html.dark .fixed.inset-0 > section,
        html.dark [role="dialog"] > section {
          background: #202020 !important; color: #f4f0e9 !important;
          border-color: #4b443a !important;
        }
        html.dark .fixed.top-0.z-50 {
          background: #1d1d1d !important; color: #f4f0e9 !important;
          border-color: #49433b !important;
        }
        html.dark .fixed.top-0.z-50 > div,
        html.dark .fixed.top-0.z-50 .bg-white,
        html.dark .fixed.top-0.z-50 [class*="bg-[#f"] {
          background: #292929 !important; color: #f4f0e9 !important;
          border-color: #49433b !important;
        }
        html.dark .fixed.inset-0 .text-\[\#777d75\],
        html.dark .fixed.inset-0 .text-\[\#887b72\],
        html.dark .fixed.inset-0 .text-\[\#6d625b\] { color: #c8beb1 !important; }
        html.dark footer { background: #090909 !important; color: #f4f0e9 !important; border-color: #39332c !important; }
        html.dark footer h3 { color: #f4f0e9 !important; }
        html.dark .fixed.bottom-5.start-5 { background: #242424 !important; color: #f4f0e9 !important; border-color: #c49a55 !important; }

      `}</style>

      {/* GENERAL PREMIUM HEADER */}
      <header className="ff-header sticky top-0 z-30 border-b backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-8 lg:px-12">
          <a href="#" className="ff-brand flex min-w-0 items-center gap-3">
            <span className="ff-logo-mark" aria-hidden="true"><span>G</span></span>
            <span className="min-w-0">
              <span className="ff-brand-caption">GENERAL FAST FOOD</span>
              <span className="ff-brand-title">{t("فست‌فود ژنرال", "GENERAL")}</span>
            </span>
          </a>
          <nav className="ff-header-nav order-3 flex w-full items-center justify-center gap-2 sm:gap-3 md:order-none md:w-auto">
            <a href="#street-menu" className="ff-nav-link">{t("منو", "Menu")}</a>
            <button type="button" onClick={() => { setClubMessage(""); setClubOpen(true); }} className="ff-header-action ff-club-button">
              <span aria-hidden="true">✦</span>{t("باشگاه مشتریان", "Loyalty club")}
            </button>
            <button type="button" onClick={() => { setTrackError(""); setTrackOpen(true); }} className="ff-header-action ff-track-button">
              <span aria-hidden="true">⌕</span>{t("پیگیری سفارش", "Track order")}
            </button>
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            <AppControls />
            <button type="button" onClick={() => setCartOpen(true)} className="ff-cart-button relative flex items-center gap-2">
              <span>{t("سبد خرید", "Bag")}</span><span aria-hidden="true">↗</span>
              {cartCount > 0 && <span className="absolute -end-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-[#f8f4ec] bg-[#c49a55] px-1 text-[11px] font-black text-white">{cartCount}</span>}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] px-4 sm:px-8 lg:px-12">
        {/* GENERAL IMMERSIVE HERO */}
        <section className="ff-hero relative mt-0 overflow-hidden rounded-none bg-[#151515] text-white shadow-[0_35px_100px_rgba(0,0,0,.20)] sm:mt-5 sm:rounded-[2rem] lg:rounded-[2.5rem]">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_78%_42%,rgba(191,52,35,.38),transparent_38%),radial-gradient(ellipse_at_0%_100%,rgba(111,24,35,.55),transparent_42%)]"/>
          <div className="absolute -right-24 -top-28 h-[32rem] w-[32rem] rounded-full border border-white/[.07]"/>
          <div className="absolute -right-8 -top-12 h-[25rem] w-[25rem] rounded-full border border-white/[.07]"/>
          <div className="relative grid min-h-[690px] items-center gap-5 px-6 py-12 sm:px-10 lg:grid-cols-[.92fr_1.08fr] lg:px-16 lg:py-16">
            <div className="relative z-10 max-w-2xl ff-reveal">
              <div className="mb-7 inline-flex items-center gap-3 rounded-full border border-[#f0b45d]/30 bg-[#f0b45d]/10 px-4 py-2 text-[10px] font-black tracking-[.2em] text-[#ffc66f]">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[#ff5a36]"/> {t("اینجا جای طعم‌های معمولی نیست","NOT BUILT TO BLEND IN")}
              </div>
              <h2 className="max-w-3xl text-[3.4rem] font-black leading-[1.02] tracking-[-.07em] sm:text-7xl lg:text-[6.3rem]">
                {t("گرسنگی؟","HUNGRY?")}<br/>
                <span className="text-[#ff5738]">{t("ژنرال","MEET")} </span>
                <span className="ff-display font-normal italic text-[#f6d8a9]">{t("رو صدا کن.","THE GENERAL.")}</span>
              </h2>
              <p className="mt-7 max-w-lg text-sm leading-8 text-white/65 sm:text-base">
                {t("یه انتخاب درست، یه طعم فراموش‌نشدنی. غذای مورد علاقه‌ات رو انتخاب کن؛ ما با کیفیت و عشق آماده‌اش می‌کنیم.","Big flavor. Serious cravings. Pick your favorite and let us make it unforgettable.")}
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-4">
                <button type="button" onClick={() => document.getElementById("street-menu")?.scrollIntoView({behavior:"smooth"})} className="group rounded-full bg-[#ff5738] px-7 py-4 text-sm font-black text-white shadow-[0_12px_35px_rgba(255,87,56,.28)] transition hover:-translate-y-1 hover:bg-[#ff704f]">
                  {t("بزن بریم سراغ منو","EXPLORE THE MENU")} <span className="ms-3 inline-block transition group-hover:-translate-x-1">↙</span>
                </button>
                <button type="button" onClick={() => { setTrackError(""); setTrackOpen(true); }} className="rounded-full border border-white/20 px-6 py-4 text-sm font-bold text-white/80 transition hover:border-[#ffc66f] hover:text-[#ffc66f]">
                  {t("پیگیری سفارش","TRACK ORDER")}
                </button>
              </div>
              <div className="mt-12 flex flex-wrap gap-x-8 gap-y-3 border-t border-white/10 pt-6 text-[10px] font-black tracking-[.18em] text-white/40">
                <span>01 / BOLD TASTE</span><span>02 / FRESH MADE</span><span>03 / PURE CRAVING</span>
              </div>
            </div>
            <div className="relative mx-auto flex min-h-[340px] w-full max-w-[560px] items-center justify-center lg:min-h-[500px]">
              <div className="absolute h-[80%] w-[80%] rounded-full bg-[#ff5738]/20 blur-[85px]"/>
              <div className="absolute h-[82%] w-[82%] rounded-full border border-dashed border-[#ffc66f]/25"/>
              <div className="ff-hero-image relative aspect-[.88/1] w-[88%] overflow-hidden rounded-[2rem] border border-white/10 bg-[#30221d] shadow-[0_35px_90px_rgba(0,0,0,.55)] sm:aspect-[1/1.05]">
                {foods.find((food) => food.imageUrl)?.imageUrl ? (
                  <img src={foods.find((food) => food.imageUrl)?.imageUrl ?? ""} alt={t("غذای ویژه ژنرال","General signature food")} className="h-full w-full scale-110 object-cover"/>
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_50%_40%,#754132,#241916_72%)]"><span className="text-[clamp(9rem,24vw,17rem)] drop-shadow-[0_25px_25px_rgba(0,0,0,.6)]">🍔</span></div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-white/5"/>
                <div className="absolute bottom-[13%] left-0 right-0 text-center">
                  <p className="text-[10px] font-black tracking-[.35em] text-[#ffc66f]">GENERAL / SIGNATURE DROP</p>
                  <p className="mt-2 text-2xl font-black text-white sm:text-3xl">{t("یه تجربه متفاوت","A DIFFERENT KIND OF BITE")}</p>
                </div>
              </div>
              <div className="absolute right-0 top-[13%] rotate-6 rounded-2xl border border-[#ffc66f]/30 bg-[#ffc66f] px-4 py-3 text-[#211612] shadow-2xl">
                <p className="text-[9px] font-black tracking-[.18em]">GENERAL</p><p className="text-sm font-black">{t("بزن به دل طعم","BITE BOLD")}</p>
              </div>
              <div className="absolute bottom-[10%] left-0 -rotate-6 rounded-2xl border border-white/15 bg-[#29201d]/90 px-4 py-3 shadow-2xl backdrop-blur">
                <p className="text-[9px] font-black tracking-[.2em] text-[#ffc66f]">MADE FOR CRAVINGS</p><p className="mt-1 text-xs font-bold text-white">{t("تازه و وسوسه‌انگیز","FRESH & IRRESISTIBLE")}</p>
              </div>
            </div>
          </div>
          <div className="relative overflow-hidden border-t border-white/10 bg-[#ff5738] py-3 text-center text-[10px] font-black tracking-[.24em] text-white sm:text-xs">
            {t("طعم معمولی؟ نه اینجا  ✳  ژنرال یعنی انتخاب جسورانه  ✳  آماده‌ای؟","NO BORING BITES  ✳  THIS IS THE GENERAL  ✳  OWN YOUR CRAVINGS")}
          </div>
        </section>

        {/* MENU INTRO + SEARCH */}
        <section id="street-menu" className="scroll-mt-28 pb-16 pt-16 sm:pt-20">
          <div className="mb-8 grid gap-6 lg:grid-cols-[1fr_380px] lg:items-end">
            <div>
              <p className="mb-3 flex items-center gap-3 text-[10px] font-black tracking-[.3em] text-[#e65338]"><span className="h-px w-8 bg-[#9b4652]"/> GENERAL GOODS / MENU</p>
              <h2 className="text-4xl font-black tracking-tight sm:text-5xl">{t("انتخاب‌های خوشمزه","Made to")} <span className="ff-display font-normal italic text-[#8a3a46]">{t("ژنرال","crave.")}</span></h2>
              <p className="mt-3 text-sm text-[#887b72]">{t("از بین طعم‌های ژنرال، انتخاب امروزت رو پیدا کن.","Find the one you came for. Or discover something new.")}</p>
            </div>
            <div className="space-y-3">
              <div className="relative">
                <span className="absolute start-5 top-1/2 -translate-y-1/2 text-xl text-[#e65338]">⌕</span>
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t("نام غذا، توضیحات یا دسته‌بندی...","Search food, description or category...")}
                  aria-label={t("جست‌وجوی منو","Search menu")}
                  className="w-full rounded-full border border-[#dfd2c5] bg-white py-4 pe-6 ps-14 text-sm text-[#302522] shadow-sm outline-none transition placeholder:text-[#9a9b91] focus:border-[#9b4652] focus:ring-4 focus:ring-[#9b4652]/10"
                />
              </div>
              <button
                type="button"
                onClick={surpriseMe}
                disabled={!foods.some((food) => food.isAvailable)}
                className="w-full rounded-full border border-[#ff5b35]/30 bg-[#ff5b35]/10 px-5 py-3 text-xs font-black text-[#b83d25] transition hover:bg-[#ff5b35] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                ✦ {t("امروز چی بخورم؟ سورپرایزم کن","Surprise me with a meal")}
              </button>
            </div>
          </div>

          <div className="ff-scroll mb-9 flex gap-2 overflow-x-auto pb-3">
            <button type="button" onClick={() => setSelectedCategory("all")} className={`shrink-0 rounded-full px-6 py-3 text-sm font-bold transition ${selectedCategory === "all" ? "bg-[#211916] text-white shadow-lg shadow-black/15" : "border border-[#dfd2c5] bg-white text-[#766a62] hover:border-[#9b4652]"}`}>{t("همه غذاها","All items")}</button>
            {categories.map((category) => <button key={category.id} type="button" onClick={() => setSelectedCategory(category.name)} className={`shrink-0 rounded-full px-6 py-3 text-sm font-bold transition ${selectedCategory === category.name ? "bg-[#211916] text-white shadow-lg shadow-black/15" : "border border-[#dfd2c5] bg-white text-[#766a62] hover:border-[#9b4652]"}`}>{category.name}</button>)}
          </div>

          <div className="mb-7 flex flex-wrap gap-2">
            {([
              ["all", t("همه غذاها", "All foods")],
              ["available", t("فقط موجودها", "Available")],
              ["favorites", t("علاقه‌مندی‌ها", "Favorites")],
            ] as const).map(([filter, label]) => (
              <button
                key={filter}
                type="button"
                onClick={() => setMenuFilter(filter)}
                aria-pressed={menuFilter === filter}
                className={`rounded-full border px-4 py-2.5 text-xs font-black transition ${
                  menuFilter === filter
                    ? "border-[#d6ff38] bg-[#090d0c] text-[#d6ff38]"
                    : "border-[#c8c9bc] bg-white text-[#4e544b] hover:border-[#ff5b35]"
                }`}
              >
                {filter === "favorites" ? "♥ " : ""}
                {label}
                {filter === "favorites" ? ` (${favoriteIds.length})` : ""}
              </button>
            ))}
          </div>

          <div className="mb-6 flex items-center justify-between border-b border-[#e5dbd0] pb-4">
            <p className="text-xs font-semibold text-[#887b72]">{t("منوی امروز","TODAY'S SELECTION")} <span className="mx-2 text-[#c49a5a]">/</span> {filteredFoods.length.toLocaleString(locale)} {t("آیتم","ITEMS")}</p>
            <span className="hidden text-[10px] font-bold tracking-[.2em] text-white/35 sm:block">FRESH. BOLD. GENERAL.</span>
          </div>

          {loading ? (
            <div className="rounded-[2rem] border border-[#e8dfd4] bg-white p-16 text-center shadow-sm"><div className="mx-auto mb-5 h-11 w-11 animate-spin rounded-full border-4 border-[#eadfd3] border-t-[#7d2030]"/><p className="text-sm font-bold text-[#887b72]">{t("داریم منو رو آماده می‌کنیم...","Preparing the menu...")}</p></div>
          ) : loadError ? (
            <div className="rounded-[2rem] border border-[#e7c9c9] bg-[#fff7f5] p-8 text-center text-[#8b2636]">{loadError}<button type="button" onClick={() => window.location.reload()} className={`mt-5 block w-full rounded-full py-3 font-bold ${redButton}`}>{t("تلاش دوباره","TRY AGAIN")}</button></div>
          ) : filteredFoods.length === 0 ? (
            <div className="rounded-[2rem] border border-[#e8dfd4] bg-white p-14 text-center"><div className="mb-4 text-5xl">⌕</div><p className="font-bold text-[#887b72]">{t("غذایی پیدا نشد.","No food found.")}</p></div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {filteredFoods.map((food, index) => (
                <article
                  id={`food-${food.id}`}
                  key={food.id}
                  style={{ animationDelay: `${index * 55}ms` }}
                  className={`ff-card ff-menu-card ff-reveal group relative flex h-full flex-col overflow-hidden rounded-[1.6rem] border border-[#e8ded2] bg-[#fffdf9] text-[#282321] shadow-[0_8px_30px_rgba(47,31,24,.07)] transition duration-300 hover:-translate-y-1.5 hover:border-[#b88b70] hover:shadow-[0_22px_48px_rgba(47,31,24,.13)] ${!food.isAvailable ? "opacity-75" : ""}`}
                >
                  <div className="relative aspect-[1.18/1] overflow-hidden bg-[#eee6dc]">
                    {food.imageUrl ? (
                      <img src={food.imageUrl} alt={food.name} loading="lazy" className={`h-full w-full object-cover transition duration-700 group-hover:scale-105 ${!food.isAvailable ? "grayscale" : ""}`} />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_50%_40%,#ead8c5,#d6c1ad)]">
                        <span className="text-8xl drop-shadow-[0_15px_14px_rgba(72,43,29,.18)]">🍔</span>
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/35 to-transparent" />
                    <span className="absolute start-4 top-4 max-w-[70%] truncate rounded-full border border-white/70 bg-[#fffdf9]/95 px-3.5 py-2 text-[10px] font-extrabold text-[#5c342d] shadow-sm backdrop-blur">{food.category}</span>
                    {!food.isAvailable && <span className="absolute end-4 top-4 rounded-full bg-[#76283a] px-3.5 py-2 text-[10px] font-extrabold text-white">{t("ناموجود","SOLD OUT")}</span>}
                    {food.isAvailable && <span className="absolute bottom-4 end-4 rounded-full bg-[#fffdf9]/95 px-3 py-1.5 text-[9px] font-extrabold text-[#527253] shadow-sm">● {t("آماده سفارش","READY TO ORDER")}</span>}
                    <button
                      type="button"
                      onClick={() => toggleFavorite(food.id)}
                      aria-label={favoriteIds.includes(food.id) ? t("حذف از علاقه‌مندی‌ها", "Remove from favorites") : t("افزودن به علاقه‌مندی‌ها", "Add to favorites")}
                      aria-pressed={favoriteIds.includes(food.id)}
                      className={`absolute bottom-4 start-4 flex h-10 w-10 items-center justify-center rounded-full border border-white/70 text-xl shadow-md backdrop-blur transition ${
                        favoriteIds.includes(food.id)
                          ? "bg-[#ff5b35] text-white"
                          : "bg-white/95 text-[#302522] hover:bg-[#ff5b35] hover:text-white"
                      }`}
                    >
                      {favoriteIds.includes(food.id) ? "♥" : "♡"}
                    </button>
                  </div>

                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex-1">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="text-[9px] font-black tracking-[.16em] text-[#a17b60]">GENERAL / MENU</span>
                        {index === 0 && <span className="rounded-full bg-[#f4e9df] px-2.5 py-1 text-[9px] font-extrabold text-[#87394a]">{t("پیشنهاد ژنرال","GENERAL PICK")}</span>}
                      </div>
                      <h3 className="line-clamp-1 text-lg font-black tracking-tight text-[#302723]">{food.name}</h3>
                      <p className="mt-2 line-clamp-2 min-h-[3rem] text-xs leading-6 text-[#82766d]">{food.description || t("توضیحاتی برای این غذا ثبت نشده است.","No description available.")}</p>
                    </div>

                    <div className="mt-5 flex items-center justify-between gap-3 border-t border-[#eee5dc] pt-4">
                      <div className="min-w-0">
                        <p className="mb-1 text-[9px] font-bold text-[#a2958a]">{t("قیمت نهایی","PRICE")}</p>
                        <p className="whitespace-nowrap text-base font-black text-[#76283a]">{formatPrice(food.price)}</p>
                      </div>
                      <button
                        type="button"
                        disabled={!food.isAvailable}
                        onClick={() => addToCart(food)}
                        className={`shrink-0 rounded-full px-4 py-3 text-[11px] font-black transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-[#ded8d1] disabled:text-[#8d857d] ${food.isAvailable ? redButton : ""}`}
                      >
                        {food.isAvailable ? <>{t("افزودن","ADD")} <span className="ms-1.5">＋</span></> : t("ناموجود","SOLD OUT")}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* FOOD FINDER / PERSONALIZED RECOMMENDATION */}
      {!foodQuizOpen && (
        <button
          type="button"
          onClick={openFoodQuiz}
          className="fixed bottom-5 start-5 z-30 flex items-center gap-2 rounded-full border border-[#e8c98e] bg-[#244b3b] px-5 py-3.5 text-sm font-black text-white shadow-[0_12px_35px_rgba(20,40,30,.28)] transition hover:-translate-y-1 hover:bg-[#315f4b]"
        >
          <span className="text-lg">🍔</span>
          {t("چی بخورم؟", "What should I eat?")}
        </button>
      )}

      {foodQuizOpen && (
        <div
          dir={direction}
          className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-[#101713]/75 p-3 backdrop-blur-md sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="food-quiz-title"
        >
          <section className="relative my-auto w-full max-w-xl overflow-hidden rounded-[2rem] border border-[#e6d7bd] bg-[#f8f5ed] text-[#202923] shadow-[0_30px_100px_rgba(0,0,0,.38)]">
            <div className="absolute inset-x-0 top-0 h-1.5 bg-[#e8dfd1]">
              <div
                className="h-full bg-[#e66b45] transition-all duration-300"
                style={{ width: `${foodQuizStep === 4 ? 100 : (foodQuizStep + 1) * 25}%` }}
              />
            </div>
            <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-7 sm:px-8">
              <div>
                <p className="mb-2 text-[10px] font-black tracking-[.22em] text-[#d45f3e]">GENERAL / FOOD FINDER</p>
                <h2 id="food-quiz-title" className="text-2xl font-black sm:text-3xl">
                  {t("امروز چی به دلت می‌شینه؟", "What are you craving today?")}
                </h2>
                <p className="mt-2 text-xs leading-6 text-[#777d75]">
                  {t("چند سؤال کوتاه؛ بعدش پیشنهاد ژنرال رو ببین.", "A few quick questions, then get your General picks.")}
                </p>
              </div>
              <button
                type="button"
                onClick={dismissFoodQuiz}
                aria-label={t("بستن", "Close")}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#ded6c9] bg-white text-xl text-[#657067] transition hover:bg-[#eee8dc]"
              >×</button>
            </div>

            <div className="px-6 pb-7 pt-4 sm:px-8">
              {foodQuizStep < 4 ? (
                <>
                  <p className="mb-4 text-[10px] font-bold text-[#9a8d7c]">
                    {t(`سؤال ${foodQuizStep + 1} از ۴`, `QUESTION ${foodQuizStep + 1} OF 4`)}
                  </p>

                  {foodQuizStep === 0 && (
                    <>
                      <h3 className="mb-4 text-lg font-black">{t("چقدر گرسنه‌ای؟", "How hungry are you?")}</h3>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          ["light", "🍟", "یه چیزی سبک", "Something light"],
                          ["normal", "🍔", "گرسنگی معمولی", "Pretty hungry"],
                          ["very", "🍕", "خیلی گرسنه‌ام", "Very hungry"],
                          ["group", "👥", "برای چند نفر", "For a group"],
                        ].map(([value, emoji, fa, en]) => (
                          <button key={value} type="button" onClick={() => { setFoodQuizAnswers((a) => ({ ...a, hunger: value })); setFoodQuizStep(1); }} className={`rounded-2xl border p-4 text-start transition hover:-translate-y-0.5 hover:border-[#244b3b] hover:bg-[#eaf0e9] ${foodQuizAnswers.hunger === value ? "border-[#244b3b] bg-[#eaf0e9]" : "border-[#e5dccf] bg-white"}`}>
                            <span className="mb-2 block text-2xl">{emoji}</span>
                            <span className="block text-sm font-black">{t(fa, en)}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}

                  {foodQuizStep === 1 && (
                    <>
                      <h3 className="mb-4 text-lg font-black">{t("امروز چه مدل غذایی می‌خوای؟", "What kind of food sounds good?")}</h3>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          ["burger", "🍔", "برگر", "Burgers"],
                          ["pizza", "🍕", "پیتزا", "Pizza"],
                          ["sandwich", "🌭", "ساندویچ", "Sandwiches"],
                          ["fried", "🍗", "سوخاری", "Fried chicken"],
                          ["any", "✨", "سورپرایزم کن", "Surprise me"],
                        ].map(([value, emoji, fa, en]) => (
                          <button key={value} type="button" onClick={() => { setFoodQuizAnswers((a) => ({ ...a, craving: value })); setFoodQuizStep(2); }} className={`rounded-2xl border p-4 text-start transition hover:border-[#244b3b] hover:bg-[#eaf0e9] ${foodQuizAnswers.craving === value ? "border-[#244b3b] bg-[#eaf0e9]" : "border-[#e5dccf] bg-white"}`}>
                            <span className="mb-2 block text-2xl">{emoji}</span>
                            <span className="block text-sm font-black">{t(fa, en)}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}

                  {foodQuizStep === 2 && (
                    <>
                      <h3 className="mb-4 text-lg font-black">{t("حدود بودجه‌ات چقدره؟", "What's your budget like?")}</h3>
                      <div className="grid gap-3">
                        {[
                          ["low", "💰", "اقتصادی", "Budget-friendly"],
                          ["mid", "💵", "متوسط", "Mid-range"],
                          ["any", "💎", "مهم نیست؛ خوشمزه باشه!", "No limit, make it tasty!"],
                        ].map(([value, emoji, fa, en]) => (
                          <button key={value} type="button" onClick={() => { setFoodQuizAnswers((a) => ({ ...a, budget: value })); setFoodQuizStep(3); }} className={`flex items-center gap-3 rounded-2xl border p-4 text-start transition hover:border-[#244b3b] hover:bg-[#eaf0e9] ${foodQuizAnswers.budget === value ? "border-[#244b3b] bg-[#eaf0e9]" : "border-[#e5dccf] bg-white"}`}>
                            <span className="text-2xl">{emoji}</span><span className="text-sm font-black">{t(fa, en)}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}

                  {foodQuizStep === 3 && (
                    <>
                      <h3 className="mb-4 text-lg font-black">{t("چه طعمی بیشتر دوست داری؟", "Which flavor do you prefer?")}</h3>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          ["spicy", "🌶️", "تند و پرادویه", "Spicy"],
                          ["cheesy", "🧀", "پنیری", "Cheesy"],
                          ["meaty", "🥩", "گوشتی و پرملات", "Meaty"],
                          ["any", "😋", "فرقی نداره", "Anything goes"],
                        ].map(([value, emoji, fa, en]) => (
                          <button key={value} type="button" onClick={() => { setFoodQuizAnswers((a) => ({ ...a, taste: value })); setFoodQuizStep(4); }} className={`rounded-2xl border p-4 text-start transition hover:border-[#244b3b] hover:bg-[#eaf0e9] ${foodQuizAnswers.taste === value ? "border-[#244b3b] bg-[#eaf0e9]" : "border-[#e5dccf] bg-white"}`}>
                            <span className="mb-2 block text-2xl">{emoji}</span><span className="block text-sm font-black">{t(fa, en)}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}

                  <div className="mt-6 flex items-center justify-between gap-3">
                    <button type="button" onClick={() => foodQuizStep === 0 ? dismissFoodQuiz() : setFoodQuizStep((step) => step - 1)} className="rounded-full border border-[#dcd2c3] px-5 py-3 text-xs font-bold text-[#687168] transition hover:bg-white">
                      {foodQuizStep === 0 ? t("فعلاً نه، رد کردن", "Not now, skip") : t("مرحله قبل", "Back")}
                    </button>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setFoodQuizStep((step) => Math.min(4, step + 1))}
                        className="rounded-full px-3 py-2 text-[10px] font-bold text-[#9a8d7c] transition hover:bg-white hover:text-[#244b3b]"
                      >
                        {t("رد این سؤال", "Skip question")}
                      </button>
                      <span className="hidden text-[10px] font-bold text-[#9a8d7c] sm:inline">{t("پاسخ‌ها اختیاری‌اند", "All answers are optional")}</span>
                    </div>
                  </div>
                </>
              ) : (
                <div>
                  <div className="mb-5 text-center">
                    <div className="mb-2 text-5xl">✨</div>
                    <h3 className="text-xl font-black">{t("پیشنهادهای ژنرال برای تو", "Your General picks")}</h3>
                    <p className="mt-2 text-xs text-[#777d75]">{t("این غذاها با توجه به انتخاب‌هایت و موجودی منو پیشنهاد شده‌اند.", "Matched to your answers and today's available menu.")}</p>
                  </div>
                  {getFoodQuizRecommendations().length > 0 ? (
                    <div className="grid gap-3">
                      {getFoodQuizRecommendations().map((food) => (
                        <article key={food.id} className="flex items-center gap-3 rounded-2xl border border-[#e5dccf] bg-white p-3">
                          {food.imageUrl ? <img src={food.imageUrl} alt={food.name} className="h-20 w-20 shrink-0 rounded-xl object-cover" /> : <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-[#eee8dc] text-3xl">🍔</div>}
                          <div className="min-w-0 flex-1">
                            <h4 className="truncate text-sm font-black">{food.name}</h4>
                            <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-[#777d75]">{food.description || food.category}</p>
                            <p className="mt-1 text-xs font-black text-[#b64c32]">{formatPrice(food.price)}</p>
                          </div>
                          <button type="button" onClick={() => { dismissFoodQuiz(); addToCart(food); }} className="shrink-0 rounded-full bg-[#244b3b] px-3 py-2.5 text-[10px] font-black text-white transition hover:bg-[#315f4b]">
                            {t("افزودن", "Add")}
                          </button>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl bg-white p-6 text-center text-sm font-bold text-[#777d75]">
                      {t("فعلاً غذای موجودی برای پیشنهاد نداریم. منو را ببین.", "No available items to recommend right now. Please browse the menu.")}
                    </div>
                  )}
                  <div className="mt-6 flex flex-wrap justify-between gap-3">
                    <button type="button" onClick={openFoodQuiz} className="rounded-full border border-[#dcd2c3] px-5 py-3 text-xs font-bold text-[#687168] hover:bg-white">
                      {t("پاسخ دوباره", "Try again")}
                    </button>
                    <button type="button" onClick={dismissFoodQuiz} className="rounded-full bg-[#244b3b] px-6 py-3 text-xs font-black text-white hover:bg-[#315f4b]">
                      {t("رفتن به منو", "Browse menu")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {/* CART BACKDROP */}
      {cartOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm"
          onClick={() => setCartOpen(false)}
        />
      )}

      {/* CART DRAWER */}
      <aside
        dir={direction}
        className={`fixed ${
          direction === "rtl" ? "right-0" : "left-0"
        } top-0 z-50 flex h-full w-full max-w-md flex-col border-[#e8dfd4] bg-[#fffaf4] shadow-2xl transition-transform duration-300 ${
          direction === "rtl" ? "border-l" : "border-r"
        } ${
          cartOpen
            ? "translate-x-0"
            : direction === "rtl"
              ? "translate-x-full"
              : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-[#e8dfd4] p-5">
          <div>
            <p className="mb-1 text-[10px] font-black tracking-[0.25em] text-red-500">
              YOUR ORDER
            </p>
            <h2 className="text-xl font-black">
              🛒 {t("سبد خرید", "YOUR CART")}
            </h2>
          </div>

          <button
            type="button"
            onClick={() => setCartOpen(false)}
            className="rounded-xl bg-white/5 px-4 py-3 text-[#6d625b] hover:bg-red-600/20"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {cartItems.length === 0 ? (
            <div className="py-16 text-center text-[#887b72]">
              <div className="mb-4 text-6xl">🛒</div>
              {t("سبد خرید خالی است.", "YOUR CART IS EMPTY.")}
            </div>
          ) : (
            <div className="space-y-4">
              {cartItems.map((item) => (
                <div
                  key={item.food.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-[#e8dfd4] bg-[#f8f2ea] p-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {item.food.imageUrl ? (
                      <img
                        src={item.food.imageUrl}
                        alt={item.food.name}
                        className="h-14 w-14 rounded-xl object-cover"
                      />
                    ) : (
                      <span className="text-3xl">🍔</span>
                    )}

                    <div className="min-w-0">
                      <h3 className="truncate font-bold">
                        {item.food.name}
                      </h3>
                      <p className={`mt-1 text-xs ${gold}`}>
                        {formatPrice(item.food.price)}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => decreaseQuantity(item.food.id)}
                      className="h-8 w-8 rounded-lg bg-[#35251f] font-bold hover:bg-red-600"
                    >
                      −
                    </button>

                    <span className="min-w-5 text-center font-bold">
                      {item.quantity}
                    </span>

                    <button
                      type="button"
                      onClick={() => addToCart(item.food)}
                      disabled={!item.food.isAvailable}
                      className="h-8 w-8 rounded-lg bg-red-600 font-bold disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-[#e8dfd4] bg-[#f2e9df] p-5">
          <div className="mb-5 flex items-center justify-between gap-2">
            <span className="font-bold text-[#887b72]">
              {t("مبلغ کل", "TOTAL")}
            </span>
            <span className={`text-xl font-black ${gold}`}>
              {formatPrice(totalPrice)}
            </span>
          </div>

          <button
            type="button"
            disabled={cartItems.length === 0}
            onClick={() => {
              setCartOpen(false);
              setCheckoutOpen(true);
            }}
            className={`w-full rounded-2xl py-4 font-black disabled:opacity-40 ${redButton}`}
          >
            {t("ادامه و ثبت سفارش", "CONTINUE TO CHECKOUT")}
          </button>
        </div>
      </aside>

      {/* CUSTOMER CLUB */}
      {clubOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <section dir={direction} className="w-full max-w-md rounded-3xl bg-[#fffdf8] p-7 text-[#203d32] shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-2xl font-black">{t("باشگاه مشتریان ژنرال","GENERAL CUSTOMER CLUB")}</h2>
              <button type="button" onClick={() => setClubOpen(false)} className="rounded-full bg-[#edf0e9] px-3 py-2">✕</button>
            </div>
            <p className="mb-6 leading-8">{t("با عضویت در باشگاه مشتریان می‌توانید کد تخفیف دریافت کنید.","Join our customer club to receive discount codes.")}</p>
            <label className="mb-2 block text-sm font-bold">{t("شماره موبایل","Mobile number")}</label>
            <input type="tel" inputMode="numeric" maxLength={11} dir="ltr" value={clubPhone} onChange={(e) => setClubPhone(e.target.value.replace(/\D/g, "").slice(0,11))} placeholder="09123456789" className="mb-4 w-full rounded-xl border border-[#d8ded4] bg-white px-4 py-3 text-left text-[#203d32] outline-none focus:border-[#e66b43]" />
            {clubMessage && <p role="status" className="mb-4 text-sm font-semibold">{clubMessage}</p>}
            <button type="button" disabled={clubSubmitting} onClick={async () => {
              setClubMessage("");
              if (!/^09\d{9}$/.test(clubPhone)) { setClubMessage(t("شماره موبایل معتبر نیست.","Enter a valid mobile number.")); return; }
              setClubSubmitting(true);
              try { const { error } = await supabase.rpc("join_customer_club", { p_phone: clubPhone }); if (error) throw error; setClubMessage(t("ثبت‌نام شما با موفقیت انجام شد.","You have joined the club successfully.")); setClubPhone(""); }
              catch (err) { console.error(err); setClubMessage(t("ثبت شماره انجام نشد. لطفاً تنظیمات پایگاه داده را بررسی کنید.","Could not save your number. Please check the database setup.")); }
              finally { setClubSubmitting(false); }
            }} className="w-full rounded-xl bg-[#203d32] px-5 py-3 font-black text-white disabled:opacity-50">{clubSubmitting ? t("در حال ثبت...","Saving...") : t("عضویت در باشگاه","Join the club")}</button>
          </section>
        </div>
      )}

      {/* CHECKOUT */}
      {checkoutOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/85 p-4 backdrop-blur-md">
          <div
            dir={direction}
            className="my-8 w-full max-w-md rounded-3xl border border-[#e8dfd4] bg-white p-6 shadow-2xl"
          >
            {!orderSubmitted ? (
              <>
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <p className="mb-1 text-[10px] font-black tracking-[0.25em] text-red-500">
                      CHECKOUT
                    </p>
                    <h2 className="text-xl font-black">
                      {t("تکمیل سفارش", "COMPLETE ORDER")}
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (!isSubmitting) {
                        setCheckoutOpen(false);
                        setFormError("");
                      }
                    }}
                    className="rounded-lg bg-white/5 px-3 py-2"
                  >
                    ✕
                  </button>
                </div>

                <div className="mb-5 rounded-2xl border border-[#e7c9c9] bg-[#f8ece8] p-4 text-sm leading-7 text-[#8b2636]">
                  {t(
                    "این سفارش به‌صورت آنلاین ثبت می‌شود و به میز خاصی متصل نیست.",
                    "This is an online order and is not assigned to a table."
                  )}
                </div>

                <div className="mb-4">
                  <label className="mb-2 block text-sm font-bold">
                    {t("نام و نام خانوادگی", "FULL NAME")}
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(event) => setCustomerName(event.target.value)}
                    placeholder={t("نام شما", "Your name")}
                    className="w-full rounded-xl border border-[#e8dfd4] bg-white px-4 py-3 text-[#211916] outline-none focus:border-red-500"
                  />
                </div>

                <div className="mb-5">
                  <label className="mb-2 block text-sm font-bold">
                    {t("توضیحات سفارش", "ORDER NOTES")}
                  </label>
                  <textarea
                    value={customerNote}
                    onChange={(event) =>
                      setCustomerNote(event.target.value.slice(0, 1000))
                    }
                    rows={3}
                    maxLength={1000}
                    placeholder={t("توضیحات دلخواه...", "Any special requests...")}
                    className="w-full resize-y rounded-xl border border-[#e8dfd4] bg-white px-4 py-3 text-[#211916] outline-none focus:border-red-500"
                  />
                </div>

                <div className="mb-5 rounded-2xl border border-[#e8dfd4] bg-[#f8f2ea] p-4">
                  <div className="mb-3 flex justify-between text-sm">
                    <span className="text-[#887b72]">
                      {t("تعداد اقلام", "ITEMS")}
                    </span>
                    <span className="font-bold">
                      {cartCount.toLocaleString(locale)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-bold">{t("مبلغ کل", "TOTAL")}</span>
                    <span className={`font-black ${gold}`}>
                      {formatPrice(totalPrice)}
                    </span>
                  </div>
                </div>

                {formError && (
                  <div
                    dir="auto"
                    className="mb-4 break-words rounded-xl border border-[#e7c9c9] bg-[#f8ece8] p-3 text-sm text-[#8b2636]"
                  >
                    {formError}
                  </div>
                )}

                <button
                  type="button"
                  onClick={submitOrder}
                  disabled={isSubmitting}
                  className={`w-full rounded-2xl py-4 font-black disabled:opacity-50 ${redButton}`}
                >
                  {isSubmitting
                    ? t("در حال ثبت سفارش...", "SUBMITTING...")
                    : t("ثبت نهایی سفارش", "PLACE ORDER")}
                </button>
              </>
            ) : (
              <div className="py-6 text-center">
                <div className="mb-5 text-7xl">🔥</div>
                <h2 className="mb-3 text-2xl font-black text-emerald-400">
                  {t("سفارش ثبت شد!", "ORDER CONFIRMED!")}
                </h2>
                <p className="mb-5 text-[#887b72]">
                  {customerName}، {t("ممنون از انتخابت!", "THANK YOU!")}
                </p>

                <div className="mb-6 rounded-2xl border border-[#f4c65e]/30 bg-[#f4c65e]/10 p-5">
                  <p className="mb-2 text-sm text-[#887b72]">
                    {t("شماره سفارش", "ORDER NUMBER")}
                  </p>
                  <p dir="ltr" className="text-4xl font-black text-[#a77b35]">
                    {orderNumber}
                  </p>
                  <p className="mt-4 mb-2 text-sm text-[#887b72]">
                    {t("کد محرمانه پیگیری؛ آن را نگه دار", "PRIVATE TRACKING CODE — KEEP IT SAFE")}
                  </p>
                  <p dir="ltr" className="break-all text-lg font-bold tracking-wider text-[#a77b35]">
                    {savedTrackingToken}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={resetOrder}
                  className={`w-full rounded-2xl py-4 font-black ${redButton}`}
                >
                  {t("بازگشت به منو", "BACK TO MENU")}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ORDER TRACKING MODAL */}
      {trackOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-black/85 p-4 backdrop-blur-md"
          onClick={(event) => {
            if (event.target === event.currentTarget) setTrackOpen(false);
          }}
        >
          <section
            dir={direction}
            className="my-6 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[2rem] border border-[#f4c65e]/20 bg-[#fffaf4] shadow-[0_25px_100px_rgba(0,0,0,.65)]"
          >
            <div className="relative overflow-hidden border-b border-[#e8dfd4] bg-gradient-to-br from-[#32151b] via-[#1c1519] to-[#17181c] p-6">
              <div className="absolute -end-12 -top-16 h-44 w-44 rounded-full bg-red-600/15 blur-3xl" />
              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <p className="mb-2 text-[10px] font-black tracking-[0.25em] text-[#a77b35]">
                    GENERAL · ORDER STATUS
                  </p>
                  <h2 className="text-2xl font-black">
                    {t("پیگیری سفارش", "TRACK YOUR ORDER")}
                  </h2>
                  <p className="mt-2 text-sm text-[#887b72]">
                    {t("وضعیت سفارش خودت رو همین‌جا ببین.", "Your order status, right here.")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setTrackOpen(false)}
                  aria-label={t("بستن", "Close")}
                  className="rounded-xl border border-[#e8dfd4] bg-black/20 px-3 py-2 text-[#6d625b] transition hover:bg-red-600"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="space-y-5 p-5 sm:p-6">
              {savedOrderNumber && savedTrackingToken ? (
                <>
                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#e8dfd4] bg-[#f8f2ea] p-4">
                    <div>
                      <p className="text-xs text-[#9b8e84]">{t("شماره سفارش شما", "YOUR ORDER NUMBER")}</p>
                      <p dir="ltr" className="mt-1 text-2xl font-black tracking-wider text-[#a77b35]">
                        {savedOrderNumber}
                      </p>
                    </div>
                    <span className="text-3xl">🧾</span>
                  </div>

                  {trackLoading && !trackedOrder ? (
                    <div className="py-8 text-center">
                      <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-[#e8dfd4] border-t-[#ed263b]" />
                      <p className="text-sm text-[#887b72]">{t("در حال دریافت وضعیت سفارش...", "Loading order status...")}</p>
                    </div>
                  ) : trackedOrder ? (
                    <>
                      <div className={`rounded-2xl border p-5 text-center ${
                        trackedOrder.status === "Ready"
                          ? "border-emerald-400/30 bg-emerald-950/35"
                          : trackedOrder.status === "Cancelled"
                            ? "border-[#e7c9c9] bg-[#f8ece8]"
                            : "border-[#f4c65e]/20 bg-[#f4c65e]/[0.06]"
                      }`}>
                        <div className="mb-2 text-4xl">
                          {trackedOrder.status === "Ready" ? "🎉" : trackedOrder.status === "Cancelled" ? "✕" : "🍳"}
                        </div>
                        <p className="text-xs text-[#887b72]">{t("وضعیت فعلی سفارش", "CURRENT STATUS")}</p>
                        <p className={`mt-2 text-xl font-black ${
                          trackedOrder.status === "Ready" ? "text-emerald-300" :
                          trackedOrder.status === "Cancelled" ? "text-[#8b2636]" : "text-[#a77b35]"
                        }`}>
                          {statusLabel(trackedOrder.status)}
                        </p>
                        {trackedOrder.status === "Ready" && (
                          <p className="mt-3 font-bold leading-7 text-emerald-200">
                            {t("سفارش شما آماده تحویل است. نوش جان!", "Your order is ready for pickup. Enjoy!")}
                          </p>
                        )}
                        {trackedOrder.status === "Preparing" && trackedOrder.estimated_ready_at && (
                          <div className="mt-4 rounded-xl border border-[#f4c65e]/20 bg-black/20 p-3">
                            <p className="text-xs text-[#887b72]">{t("زمان تقریبی آماده‌شدن", "ESTIMATED READY TIME")}</p>
                            <p className="mt-1 text-lg font-black text-[#a77b35]">
                              {formatDateTime(trackedOrder.estimated_ready_at)}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="rounded-2xl border border-[#e8dfd4] bg-[#f8f2ea] p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <h3 className="font-black">{t("خلاصه سفارش", "ORDER SUMMARY")}</h3>
                          <span className="text-xs text-[#9b8e84]">{formatPrice(Number(trackedOrder.total_amount))}</span>
                        </div>
                        <div className="space-y-3">
                          {trackedOrder.items?.map((item, index) => (
                            <div key={`${item.food_name}-${index}`} className="flex items-center justify-between gap-3 text-sm">
                              <span className="text-[#6d625b]">{item.food_name} × {item.quantity}</span>
                              <span className="shrink-0 text-[#887b72]">{formatPrice(Number(item.unit_price) * item.quantity)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-[#9b8e84]">
                        <span>{t("به‌روزرسانی خودکار هر ۱۰ ثانیه", "Auto-refresh every 10 seconds")}</span>
                        <span>{lastUpdated ? `${t("آخرین بررسی:", "Last checked:")} ${lastUpdated}` : ""}</span>
                      </div>
                    </>
                  ) : null}
                </>
              ) : (
                <div className="rounded-2xl border border-[#e8dfd4] bg-[#f8f2ea] p-5 text-center">
                  <div className="mb-3 text-5xl">📦</div>
                  <h3 className="font-black">{t("هنوز سفارشی ثبت نکردی", "No order yet")}</h3>
                  <p className="mt-2 text-sm leading-7 text-[#887b72]">
                    {t("بعد از ثبت سفارش، شماره و اطلاعات پیگیری به‌صورت خودکار در همین مرورگر ذخیره می‌شود و دیگر نیازی به وارد کردن دوباره شماره موبایل نیست.", "After placing an order, its tracking details are saved in this browser. Use your private tracking code to view this order.")}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setTrackOpen(false);
                      document.getElementById("street-menu")?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className={`mt-5 w-full rounded-xl py-3 font-black ${redButton}`}
                  >
                    {t("رفتن به منو", "GO TO MENU")}
                  </button>
                </div>
              )}

              {trackError && (
                <div className="rounded-xl border border-[#e7c9c9] bg-[#f8ece8] p-3 text-sm leading-6 text-[#8b2636]">
                  {trackError}
                </div>
              )}

              {savedOrderNumber && savedTrackingToken && (
                <button
                  type="button"
                  onClick={() => void fetchTrackedOrder()}
                  disabled={trackLoading}
                  className="w-full rounded-xl border border-[#e8dfd4] bg-white/[0.04] py-3 text-sm font-bold text-gray-200 transition hover:border-[#f4c65e]/40 hover:bg-white/[0.07] disabled:opacity-50"
                >
                  {trackLoading ? t("در حال بررسی...", "Checking...") : t("به‌روزرسانی وضعیت", "REFRESH STATUS")}
                </button>
              )}
            </div>
          </section>
        </div>
      )}

      {/* FOOTER */}
      <footer className="border-t border-[#e8dfd4] bg-[#101115] px-4 py-12 text-center">
        <div className="ff-logo-mark mx-auto mb-4" aria-label="General Fast Food"><span>G</span></div>

        <h3 className="text-xl font-black text-[#fffdf9]">
          GENERAL <span className="text-[#c49a55]">FAST FOOD</span>
        </h3>

        <div className="mx-auto mt-7 h-px max-w-xs bg-gradient-to-r from-transparent via-red-600/60 to-transparent" />

        <p className="mt-5 text-[10px] tracking-[0.2em] text-white/35">
          © GENERAL FAST FOOD
        </p>
      </footer>
    </main>
  );
}
