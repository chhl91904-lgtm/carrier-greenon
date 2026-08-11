// 화면 전환에 필요한 버튼과 화면을 한 번만 찾아 재사용합니다.
const navigationButtons = document.querySelectorAll("[data-target]");
const screens = document.querySelectorAll("[data-screen]");
const shortcutButtons = document.querySelectorAll("[data-go-to]");
const notificationButton = document.querySelector(".notification-button");
const toast = document.querySelector(".toast");
const airconCard = document.querySelector("[data-aircon-card]");
const airconSummary = document.querySelector("[data-aircon-summary]");
const simulationButtons = document.querySelectorAll("[data-simulation]");
const missionCard = document.querySelector("[data-mission-card]");
const missionStartButton = document.querySelector("[data-mission-start]");
const missionActionButtons = document.querySelectorAll("[data-mission-action]");
const pointBalanceElements = document.querySelectorAll("[data-point-balance]");
const transactionList = document.querySelector("[data-transaction-list]");
const walletEmpty = document.querySelector("[data-wallet-empty]");
const categoryButtons = document.querySelectorAll("[data-category]");
const rewardList = document.querySelector("[data-reward-list]");
const rewardDialog = document.querySelector("[data-reward-dialog]");
const rewardDialogClose = document.querySelector("[data-dialog-close]");
const purchaseButton = document.querySelector("[data-purchase-button]");
const purchaseWarning = document.querySelector("[data-purchase-warning]");
const orderList = document.querySelector("[data-order-list]");
const orderEmpty = document.querySelector("[data-order-empty]");
const authGuest = document.querySelector("[data-auth-guest]");
const authUserDashboard = document.querySelector("[data-auth-user]");
const authModeButtons = document.querySelectorAll("[data-auth-mode]");
const authForm = document.querySelector("[data-auth-form]");
const authError = document.querySelector("[data-auth-error]");
const logoutButton = document.querySelector("[data-logout]");

// 브라우저에는 공개 가능한 publishable key만 전달합니다. secret/service_role 키는 허용하지 않습니다.
const supabaseSettings = window.GREENON_CONFIG ?? {};
const hasSafeSupabaseConfig =
  typeof supabaseSettings.supabaseUrl === "string" &&
  typeof supabaseSettings.supabasePublishableKey === "string" &&
  supabaseSettings.supabasePublishableKey.startsWith("sb_publishable_");
const supabaseClient = hasSafeSupabaseConfig && window.supabase?.createClient
  ? window.supabase.createClient(
      supabaseSettings.supabaseUrl,
      supabaseSettings.supabasePublishableKey,
      { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } },
    )
  : null;

const DEMO_STORAGE_KEY = "carrierGreenON.demoWallet";
const TODAY_MISSION_ID = "mission-2026-08-11-eco-cooling";
const DEMO_USER_KEY = "carrierGreenON.demoUser";

// Supabase 연결에 실패해도 화면을 확인할 수 있도록 동일한 구조의 폴백 데이터를 둡니다.
let rewards = [
  { id: "reward-coffee", category: "FOOD", name: "다회용 컵 음료 쿠폰", price: 80, icon: "☕", description: "개인 다회용 컵 사용 시 즐길 수 있는 친환경 음료 교환 쿠폰이에요." },
  { id: "reward-snack", category: "FOOD", name: "저탄소 간식 세트", price: 150, icon: "🍪", description: "환경을 생각한 포장과 원료로 만든 가벼운 간식 세트예요." },
  { id: "reward-towel", category: "LIFE", name: "업사이클 미니 타월", price: 110, icon: "🧺", description: "버려지는 원단을 다시 활용해 만든 부드러운 미니 타월이에요." },
  { id: "reward-bag", category: "LIFE", name: "GreenON 에코백", price: 220, icon: "🛍️", description: "장보기와 일상에서 오래 사용할 수 있는 튼튼한 GreenON 에코백이에요." },
  { id: "reward-filter", category: "CARRIER", name: "캐리어 필터 케어 쿠폰", price: 300, icon: "❄️", description: "깨끗하고 효율적인 냉방을 위한 가상 필터 케어 서비스 쿠폰이에요." },
  { id: "reward-sticker", category: "CARRIER", name: "GreenON 스티커 팩", price: 60, icon: "🌿", description: "에어컨과 다이어리를 꾸밀 수 있는 친환경 GreenON 스티커 팩이에요." },
];

let selectedRewardId = null;
let selectedCategory = "ALL";
let authMode = "login";
let activeMissionRecord = null;
let activeUserMissionId = null;

/** Supabase Auth 연결 전 사용할 최소 데모 세션만 읽습니다. 비밀번호는 저장하지 않습니다. */
function loadDemoUser() {
  try {
    const user = JSON.parse(window.localStorage.getItem(DEMO_USER_KEY));
    if (user?.email && user?.name) return user;
  } catch (error) {
    console.warn("데모 사용자 정보를 읽지 못했습니다.", error);
  }
  return null;
}

let currentUser = supabaseClient ? null : loadDemoUser();

/** Supabase 사용자 객체에서 화면 표시용 정보만 꺼냅니다. 메타데이터는 권한 판단에 사용하지 않습니다. */
function toAppUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email ?? "",
    name: user.user_metadata?.display_name || user.email?.split("@")[0] || "GreenON 사용자",
  };
}

let toastTimer;

// 실제 Carrier API 대신 화면 학습용 가상 에어컨 데이터를 사용합니다.
const airconState = {
  power: true,
  mode: "냉방",
  temperature: 26,
  fan: "자동풍",
  minutesUsed: 90,
  filter: "깨끗함",
  sensor: "정상",
  issue: null,
};

// 미션 상태는 참여 전, 진행 중, 성공, 실패의 네 단계로 관리합니다.
const missionState = {
  status: "idle",
  elapsedMinutes: 0,
  warning: "",
};

// 날씨 API가 느리거나 사용할 수 없을 때 보여줄 서울 샘플 데이터입니다.
const weatherState = {
  temperature: 29,
  humidity: 65,
  pm25: 18,
  weatherCode: 0,
  condition: "맑음",
  source: "sample",
};

/** Open-Meteo WMO 날씨 코드를 짧은 한글 상태로 변환합니다. */
function getWeatherCondition(code) {
  if (code === 0) return "맑음";
  if ([1, 2, 3].includes(code)) return "구름 많음";
  if ([45, 48].includes(code)) return "안개";
  if ([51, 53, 55, 56, 57].includes(code)) return "이슬비";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "비";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "눈";
  if ([95, 96, 99].includes(code)) return "뇌우";
  return "날씨 확인 중";
}

/** 현재 날씨를 홈 카드와 날씨 조건별 미션 추천 문구에 반영합니다. */
function renderWeather() {
  document.querySelector("[data-weather-temperature]").textContent = Math.round(weatherState.temperature);
  document.querySelector("[data-weather-humidity]").textContent = Math.round(weatherState.humidity);
  document.querySelector("[data-weather-pm25]").textContent = Math.round(weatherState.pm25);
  document.querySelector("[data-weather-detail]").textContent = `서울 · ${weatherState.condition}`;

  let advice = "쾌적한 날에도 26°C 절전 냉방으로 좋은 습관을 이어가세요.";
  if (weatherState.temperature >= 30) advice = "폭염에는 26°C 이상과 자동풍을 유지해 과도한 냉방을 줄여보세요.";
  else if (weatherState.humidity >= 75) advice = "습도가 높은 날에는 짧은 제습 후 26°C 냉방으로 전환해 보세요.";
  else if (weatherState.temperature >= 27) advice = "더운 날에는 26°C 절전 냉방으로 에너지를 아껴보세요.";
  else if (weatherState.temperature < 24) advice = "선선한 날에는 에어컨을 끄고 자연 바람을 활용해 보세요.";

  document.querySelector("[data-weather-advice]").textContent = advice;
  document.querySelector("[data-weather-mission-message]").textContent =
    `${Math.round(weatherState.temperature)}°C · 습도 ${Math.round(weatherState.humidity)}% 날씨에 맞춘 미션이에요. ${advice}`;
}

/** 키가 필요 없는 Open-Meteo API에서 서울의 현재 날씨와 PM2.5를 가져옵니다. */
async function loadCurrentWeather() {
  const weatherEndpoint = "https://api.open-meteo.com/v1/forecast?latitude=37.5665&longitude=126.978&current=temperature_2m,relative_humidity_2m,weather_code&timezone=Asia%2FSeoul";
  const airQualityEndpoint = "https://air-quality-api.open-meteo.com/v1/air-quality?latitude=37.5665&longitude=126.978&current=pm2_5&timezone=Asia%2FSeoul";

  // 두 API는 서로 독립적이므로 한쪽이 실패해도 다른 실시간 값은 화면에 반영합니다.
  const [weatherResult, airQualityResult] = await Promise.allSettled([
    fetch(weatherEndpoint).then((response) => {
      if (!response.ok) throw new Error(`Weather API ${response.status}`);
      return response.json();
    }),
    fetch(airQualityEndpoint).then((response) => {
      if (!response.ok) throw new Error(`Air quality API ${response.status}`);
      return response.json();
    }),
  ]);

  if (weatherResult.status === "fulfilled") {
    const data = weatherResult.value;
    Object.assign(weatherState, {
      temperature: data.current.temperature_2m,
      humidity: data.current.relative_humidity_2m,
      weatherCode: data.current.weather_code,
      condition: getWeatherCondition(data.current.weather_code),
      source: "open-meteo",
    });
  } else {
    console.warn("실시간 날씨를 불러오지 못해 샘플 데이터를 사용합니다.", weatherResult.reason);
  }

  if (airQualityResult.status === "fulfilled") {
    weatherState.pm25 = airQualityResult.value.current.pm2_5;
  } else {
    console.warn("실시간 미세먼지를 불러오지 못해 샘플 데이터를 사용합니다.", airQualityResult.reason);
  }

  renderWeather();
}

/**
 * Supabase 전환 전 단계에서 새로고침 후 포인트가 사라지지 않도록 localStorage를 사용합니다.
 * JSON이 손상된 경우에도 앱이 멈추지 않도록 안전한 기본값으로 복구합니다.
 */
function loadWalletState() {
  try {
    const savedState = JSON.parse(window.localStorage.getItem(DEMO_STORAGE_KEY));
    if (savedState && Number.isFinite(savedState.balance) && Array.isArray(savedState.transactions)) {
      return {
        balance: savedState.balance,
        transactions: savedState.transactions,
        completedMissionIds: Array.isArray(savedState.completedMissionIds) ? savedState.completedMissionIds : [],
        orders: Array.isArray(savedState.orders) ? savedState.orders : [],
      };
    }
  } catch (error) {
    console.warn("저장된 지갑 데이터를 읽지 못해 기본값으로 시작합니다.", error);
  }

  return { balance: 0, transactions: [], completedMissionIds: [], orders: [] };
}

const walletState = supabaseClient
  ? { balance: 0, transactions: [], completedMissionIds: [], orders: [] }
  : loadWalletState();

/** 현재 지갑 데이터를 브라우저 임시 저장소에 보관합니다. */
function saveWalletState() {
  if (supabaseClient) return;
  window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(walletState));
}

/** 포인트 숫자를 세 자리마다 쉼표가 있는 형식으로 표시합니다. */
function formatPoint(point) {
  return new Intl.NumberFormat("ko-KR").format(point);
}

/** localStorage 값을 HTML에 넣기 전에 특수문자를 치환해 화면 주입을 막습니다. */
function escapeHtml(value) {
  const element = document.createElement("span");
  element.textContent = String(value);
  return element.innerHTML;
}

/** Supabase 날짜를 포인트/구매내역에서 사용할 짧은 한글 날짜로 바꿉니다. */
function formatDatabaseDate(value) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).format(new Date(value));
}

/** 로그인 여부와 관계없이 공개된 미션·리워드 카탈로그를 Supabase에서 읽습니다. */
async function loadSupabaseCatalogs() {
  if (!supabaseClient) return;

  const [missionResult, rewardResult] = await Promise.all([
    supabaseClient.from("missions").select("id, code, title, description, required_minutes, min_temperature, reward_points").eq("active", true).limit(1).maybeSingle(),
    supabaseClient.from("rewards").select("id, code, category, name, description, icon, price").eq("active", true).order("price"),
  ]);

  if (missionResult.error) console.error("미션 데이터를 불러오지 못했습니다.", missionResult.error);
  if (rewardResult.error) console.error("리워드 데이터를 불러오지 못했습니다.", rewardResult.error);

  if (missionResult.data) activeMissionRecord = missionResult.data;
  if (rewardResult.data?.length) {
    rewards = rewardResult.data.map((reward) => ({
      id: reward.id,
      code: reward.code,
      category: reward.category,
      name: reward.name,
      description: reward.description,
      icon: reward.icon,
      price: reward.price,
    }));
    renderRewards();
  }
}

/** 로그인 사용자의 소유 데이터만 RLS를 통과해 읽고 모든 화면 상태를 동기화합니다. */
async function loadSupabaseUserData() {
  if (!supabaseClient || !currentUser) return;

  const [profileResult, missionResult, pointResult, orderResult, airconResult] = await Promise.all([
    supabaseClient.from("profiles").select("display_name, green_level").eq("id", currentUser.id).maybeSingle(),
    supabaseClient.from("user_missions").select("id, mission_id, status, progress_minutes, warning, mission_date").order("started_at", { ascending: false }),
    supabaseClient.from("point_transactions").select("id, amount, transaction_type, title, created_at").order("created_at", { ascending: false }),
    supabaseClient.from("reward_orders").select("id, point_price, status, purchased_at, rewards(name, icon)").order("purchased_at", { ascending: false }),
    supabaseClient.from("aircon_status").select("power, mode, set_temperature, fan, usage_minutes, filter_status, sensor_status, issue").eq("user_id", currentUser.id).maybeSingle(),
  ]);

  const firstError = [profileResult, missionResult, pointResult, orderResult, airconResult].find((result) => result.error)?.error;
  if (firstError) {
    console.error("Supabase 사용자 데이터를 동기화하지 못했습니다.", firstError);
    showToast("사용자 데이터를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
    return;
  }

  if (profileResult.data?.display_name) currentUser.name = profileResult.data.display_name;

  walletState.transactions = (pointResult.data ?? []).map((transaction) => ({
    id: transaction.id,
    type: transaction.amount > 0 ? "earn" : "use",
    amount: Math.abs(transaction.amount),
    title: transaction.title,
    date: formatDatabaseDate(transaction.created_at),
  }));
  walletState.balance = (pointResult.data ?? []).reduce((sum, transaction) => sum + transaction.amount, 0);
  walletState.completedMissionIds = (missionResult.data ?? [])
    .filter((mission) => mission.status === "success")
    .map((mission) => mission.mission_id);
  walletState.orders = (orderResult.data ?? []).map((order) => ({
    id: order.id,
    name: order.rewards?.name ?? "GREEN REWARD",
    icon: order.rewards?.icon ?? "🎁",
    price: order.point_price,
    date: formatDatabaseDate(order.purchased_at),
  }));

  const latestMission = missionResult.data?.[0];
  const warningMessages = {
    POWER_OFF: "에어컨 전원이 꺼져 미션이 종료됐어요.",
    MODE_VIOLATION: "냉방 MODE가 아니어서 미션이 종료됐어요.",
    TEMPERATURE_VIOLATION: "설정 온도가 26°C보다 낮아 미션이 종료됐어요.",
    DEVICE_ERROR: "에어컨 점검 상태로 인해 미션이 종료됐어요.",
    AIRCON_STATUS_NOT_FOUND: "가상 에어컨 상태를 찾지 못했어요.",
  };
  activeUserMissionId = latestMission?.id ?? null;
  missionState.status = latestMission
    ? ({ in_progress: "running", success: "success", failed: "failed" }[latestMission.status] ?? "idle")
    : "idle";
  missionState.elapsedMinutes = latestMission?.progress_minutes ?? 0;
  missionState.warning = warningMessages[latestMission?.warning] ?? latestMission?.warning ?? "";

  if (airconResult.data) {
    Object.assign(airconState, {
      power: airconResult.data.power,
      mode: ({ cool: "냉방", fan: "송풍", dry: "제습", auto: "자동" })[airconResult.data.mode] ?? "냉방",
      temperature: Number(airconResult.data.set_temperature),
      fan: ({ low: "약풍", medium: "중풍", high: "강풍", auto: "자동풍" })[airconResult.data.fan] ?? "자동풍",
      minutesUsed: airconResult.data.usage_minutes,
      filter: airconResult.data.filter_status === "clean" ? "깨끗함" : "점검 필요",
      sensor: airconResult.data.sensor_status === "normal" ? "정상" : "오류",
      issue: airconResult.data.issue,
    });
  }

  renderAirconState();
  renderMission();
  renderWallet();
  renderOrders();
  renderProfile();
}

/** 현재 가상 에어컨 상태를 로그인 사용자의 Supabase 행에 저장합니다. */
async function persistAirconState() {
  if (!supabaseClient || !currentUser) return;

  const { error } = await supabaseClient
    .from("aircon_status")
    .update({
      power: airconState.power,
      mode: ({ 냉방: "cool", 송풍: "fan", 제습: "dry", 자동: "auto" })[airconState.mode] ?? "cool",
      set_temperature: airconState.temperature,
      fan: ({ 약풍: "low", 중풍: "medium", 강풍: "high", 자동풍: "auto" })[airconState.fan] ?? "auto",
      usage_minutes: airconState.minutesUsed,
      filter_status: airconState.filter === "깨끗함" ? "clean" : "needs_check",
      sensor_status: airconState.sensor === "정상" ? "normal" : "error",
      issue: airconState.issue,
    })
    .eq("user_id", currentUser.id);

  if (error) {
    console.error("가상 에어컨 상태 저장에 실패했습니다.", error);
    showToast("에어컨 상태를 저장하지 못했어요.");
  }
}

/** 포인트 적립/사용 기록을 최신순으로 보여줍니다. */
function renderWallet() {
  const totalEarned = walletState.transactions
    .filter((transaction) => transaction.type === "earn")
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const totalUsed = walletState.transactions
    .filter((transaction) => transaction.type === "use")
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  pointBalanceElements.forEach((element) => {
    element.textContent = formatPoint(walletState.balance);
  });
  document.querySelector("[data-total-earned]").textContent = formatPoint(totalEarned);
  document.querySelector("[data-total-used]").textContent = formatPoint(totalUsed);
  document.querySelector("[data-transaction-count]").textContent = `${walletState.transactions.length}건`;
  walletEmpty.hidden = walletState.transactions.length > 0;

  transactionList.innerHTML = walletState.transactions
    .map((transaction) => {
      const isEarn = transaction.type === "earn";
      const sign = isEarn ? "+" : "-";
      return `
        <article class="transaction-item ${isEarn ? "is-earn" : "is-use"}">
          <span class="transaction-icon" aria-hidden="true">${isEarn ? "🌿" : "🎁"}</span>
          <div class="transaction-copy">
            <strong>${escapeHtml(transaction.title)}</strong>
            <small>${escapeHtml(transaction.date)}</small>
          </div>
          <span class="transaction-amount">${sign}${formatPoint(transaction.amount)}P</span>
        </article>
      `;
    })
    .join("");
}

/** 선택한 카테고리에 맞는 리워드 상품 카드를 그립니다. */
function renderRewards() {
  const visibleRewards = selectedCategory === "ALL"
    ? rewards
    : rewards.filter((reward) => reward.category === selectedCategory);

  rewardList.innerHTML = visibleRewards
    .map((reward) => `
      <article class="reward-card">
        <div class="reward-image" aria-hidden="true">${reward.icon}</div>
        <div class="reward-card-body">
          <span class="reward-card-category">${reward.category}</span>
          <h2>${reward.name}</h2>
          <div class="reward-card-footer">
            <span class="reward-price">${formatPoint(reward.price)}P</span>
            <button class="reward-detail-button" type="button" data-reward-id="${reward.id}" aria-label="${reward.name} 상세 보기">→</button>
          </div>
        </div>
      </article>
    `)
    .join("");
}

/** 구매한 상품을 최신순으로 보여주고 구매 건수를 갱신합니다. */
function renderOrders() {
  document.querySelector("[data-order-count]").textContent = `${walletState.orders.length}건`;
  orderEmpty.hidden = walletState.orders.length > 0;
  orderList.innerHTML = walletState.orders
    .map((order) => `
      <article class="order-item">
        <span aria-hidden="true">${escapeHtml(order.icon)}</span>
        <div>
          <strong>${escapeHtml(order.name)}</strong>
          <small>${escapeHtml(order.date)} · ${formatPoint(order.price)}P 사용</small>
        </div>
        <em class="order-status">구매 완료</em>
      </article>
    `)
    .join("");
}

/** 누적 활동에 따라 GREEN LEVEL과 다음 레벨 진행률을 계산합니다. */
function getGreenLevel(lifetimePoint) {
  if (lifetimePoint >= 500) {
    return { name: "나무", icon: "🌳", minimum: 500, next: null, message: "꾸준한 친환경 냉방으로 멋진 나무가 되었어요." };
  }
  if (lifetimePoint >= 200) {
    return { name: "잎새", icon: "🌿", minimum: 200, next: 500, message: "좋은 냉방 습관이 싱그러운 잎으로 자라고 있어요." };
  }
  return { name: "새싹", icon: "🌱", minimum: 0, next: 200, message: "첫 번째 친환경 미션으로 성장을 시작해 보세요." };
}

/** 로그인 상태와 사용자의 GREEN LEVEL·REPORT를 최신 데이터로 표시합니다. */
function renderProfile() {
  const isLoggedIn = Boolean(currentUser);
  authGuest.hidden = isLoggedIn;
  authUserDashboard.hidden = !isLoggedIn;
  if (!isLoggedIn) return;

  const lifetimePoint = walletState.transactions
    .filter((transaction) => transaction.type === "earn")
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const level = getGreenLevel(lifetimePoint);
  const progress = level.next
    ? Math.min(((lifetimePoint - level.minimum) / (level.next - level.minimum)) * 100, 100)
    : 100;

  document.querySelector("[data-profile-name]").textContent = currentUser.name;
  document.querySelector("[data-profile-email]").textContent = currentUser.email;
  document.querySelector("[data-level-icon]").textContent = level.icon;
  document.querySelector("[data-level-name]").textContent = level.name;
  document.querySelector("[data-level-message]").textContent = level.message;
  document.querySelector("[data-lifetime-point]").textContent = formatPoint(lifetimePoint);
  document.querySelector("[data-level-progress]").style.width = `${progress}%`;
  document.querySelector(".level-progress-track").setAttribute("aria-valuenow", String(Math.round(progress)));
  document.querySelector("[data-next-level]").textContent = level.next
    ? `다음 레벨까지 ${formatPoint(level.next - lifetimePoint)}P`
    : "최고 레벨을 달성했어요";
  document.querySelector("[data-report-missions]").textContent = walletState.completedMissionIds.length;
  document.querySelector("[data-report-points]").textContent = formatPoint(lifetimePoint);
  document.querySelector("[data-report-hours]").textContent = walletState.completedMissionIds.length * 2;
  document.querySelector("[data-report-orders]").textContent = walletState.orders.length;
}

/** 로그인/회원가입 탭에 맞춰 이름 필드와 버튼 문구를 바꿉니다. */
function renderAuthMode() {
  const isSignup = authMode === "signup";
  document.querySelector(".signup-name-field").hidden = !isSignup;
  document.querySelector("[name='name']").required = isSignup;
  document.querySelector("[data-auth-submit]").textContent = isSignup ? "회원가입" : "로그인";
  document.querySelector("[name='password']").autocomplete = isSignup ? "new-password" : "current-password";
  authError.hidden = true;

  authModeButtons.forEach((button) => {
    const isActive = button.dataset.authMode === authMode;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });
}

/** 데모 인증 폼을 검증하고 비밀번호를 저장하지 않은 채 사용자 세션을 만듭니다. */
async function handleAuthSubmit(event) {
  event.preventDefault();
  const formData = new FormData(authForm);
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const enteredName = String(formData.get("name") ?? "").trim();

  if (!email.includes("@") || password.length < 6 || (authMode === "signup" && !enteredName)) {
    authError.textContent = "이메일 형식, 6자 이상의 비밀번호와 필수 입력값을 확인해 주세요.";
    authError.hidden = false;
    return;
  }

  const submitButton = document.querySelector("[data-auth-submit]");
  submitButton.disabled = true;
  submitButton.textContent = "연결 중...";
  authError.hidden = true;

  try {
    if (supabaseClient) {
      if (authMode === "signup") {
        const { data, error } = await supabaseClient.auth.signUp({
          email,
          password,
          options: { data: { display_name: enteredName } },
        });
        if (error) throw error;

        if (!data.session) {
          authError.textContent = "가입 확인 메일을 보냈어요. 이메일 인증 후 로그인해 주세요.";
          authError.hidden = false;
          showToast("이메일 인증을 완료해 주세요.");
        } else {
          currentUser = toAppUser(data.user);
          authForm.reset();
          renderProfile();
          await loadSupabaseUserData();
          showToast("GreenON 회원가입을 완료했어요.");
        }
      } else {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        currentUser = toAppUser(data.user);
        authForm.reset();
        renderProfile();
        await loadSupabaseUserData();
        showToast("GreenON에 로그인했어요.");
      }
    } else {
      currentUser = {
        name: authMode === "signup" ? enteredName : email.split("@")[0],
        email,
      };
      window.localStorage.setItem(DEMO_USER_KEY, JSON.stringify(currentUser));
      authForm.reset();
      renderProfile();
      showToast(authMode === "signup" ? "데모 회원가입을 완료했어요." : "데모 계정으로 로그인했어요.");
    }
  } catch (error) {
    console.error("인증 요청에 실패했습니다.", error);
    authError.textContent = authMode === "signup"
      ? "회원가입에 실패했어요. 이미 가입된 이메일인지 확인해 주세요."
      : "로그인에 실패했어요. 이메일과 비밀번호를 확인해 주세요.";
    authError.hidden = false;
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = authMode === "signup" ? "회원가입" : "로그인";
  }
}

/** Supabase 또는 데모 세션을 종료하며 앱 데이터는 보존합니다. */
async function logoutUser() {
  if (supabaseClient) {
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
      showToast("로그아웃 중 문제가 발생했어요. 다시 시도해 주세요.");
      return;
    }
  } else {
    window.localStorage.removeItem(DEMO_USER_KEY);
  }

  currentUser = null;
  renderProfile();
  showToast("안전하게 로그아웃했어요.");
}

/** 저장된 Supabase 세션을 복구하고 이후 로그인 상태 변화를 구독합니다. */
async function initializeSupabaseAuth() {
  const connectionBadge = document.querySelector("[data-auth-connection]");
  if (!supabaseClient) {
    connectionBadge.textContent = "데모 모드";
    connectionBadge.classList.add("is-demo");
    return;
  }

  connectionBadge.textContent = "Supabase 클라이언트 연결됨";
  connectionBadge.classList.add("is-connected");
  window.localStorage.removeItem(DEMO_STORAGE_KEY);
  window.localStorage.removeItem(DEMO_USER_KEY);
  await loadSupabaseCatalogs();

  const { data, error } = await supabaseClient.auth.getSession();
  if (error) {
    console.error("Supabase 세션을 불러오지 못했습니다.", error);
    connectionBadge.textContent = "Supabase 연결 오류";
    return;
  }
  connectionBadge.textContent = "Supabase 보안 연결됨";
  connectionBadge.classList.add("is-connected");
  currentUser = toAppUser(data?.session?.user);
  renderProfile();
  if (currentUser) await loadSupabaseUserData();

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    currentUser = toAppUser(session?.user);
    renderProfile();
    if (currentUser) {
      // Auth 콜백 안에서 다른 Supabase 요청을 직접 await하지 않고 다음 작업 큐에서 실행합니다.
      window.setTimeout(() => loadSupabaseUserData(), 0);
    }
  });
}

/** 상품 상세 모달을 열고 선택 상품 정보를 채웁니다. */
function openRewardDialog(rewardId) {
  const reward = rewards.find((item) => item.id === rewardId);
  if (!reward) return;

  selectedRewardId = reward.id;
  rewardDialog.querySelector("[data-dialog-image]").textContent = reward.icon;
  rewardDialog.querySelector("[data-dialog-category]").textContent = reward.category;
  rewardDialog.querySelector("[data-dialog-title]").textContent = reward.name;
  rewardDialog.querySelector("[data-dialog-description]").textContent = reward.description;
  rewardDialog.querySelector("[data-dialog-price]").textContent = formatPoint(reward.price);
  purchaseWarning.hidden = true;
  rewardDialog.classList.remove("is-danger");

  if (!rewardDialog.open) rewardDialog.showModal();
}

/** 잔액을 확인한 뒤 포인트를 차감하고 구매·사용 기록을 동시에 남깁니다. */
async function purchaseSelectedReward() {
  const reward = rewards.find((item) => item.id === selectedRewardId);
  if (!reward) return;

  if (supabaseClient) {
    if (!currentUser) {
      rewardDialog.close();
      changeScreen("my");
      showToast("리워드를 구매하려면 먼저 로그인해 주세요.");
      return;
    }

    const { error } = await supabaseClient.rpc("purchase_reward", { p_reward_id: reward.id });
    if (error) {
      if (error.message?.includes("INSUFFICIENT_POINTS")) {
        purchaseWarning.hidden = false;
        rewardDialog.classList.add("is-danger");
        showToast(`포인트가 ${formatPoint(Math.max(reward.price - walletState.balance, 0))}P 부족해요.`);
      } else {
        console.error("리워드 구매에 실패했습니다.", error);
        showToast("리워드 구매 중 문제가 발생했어요.");
      }
      return;
    }

    await loadSupabaseUserData();
    rewardDialog.close();
    showToast(`${reward.name} 구매를 완료했어요!`);
    return;
  }

  if (walletState.balance < reward.price) {
    purchaseWarning.hidden = false;
    rewardDialog.classList.add("is-danger");
    showToast(`포인트가 ${formatPoint(reward.price - walletState.balance)}P 부족해요.`);
    return;
  }

  walletState.balance -= reward.price;
  walletState.transactions.unshift({
    id: `point-${Date.now()}`,
    type: "use",
    amount: reward.price,
    title: `${reward.name} 구매`,
    date: "2026. 8. 11. 오늘",
  });
  walletState.orders.unshift({
    id: `order-${Date.now()}`,
    rewardId: reward.id,
    name: reward.name,
    icon: reward.icon,
    price: reward.price,
    date: "2026. 8. 11. 오늘",
  });
  saveWalletState();
  renderWallet();
  renderOrders();
  renderProfile();
  rewardDialog.close();
  showToast(`${reward.name} 구매를 완료했어요!`);
}

/** 오늘의 미션 성공 보상을 중복 없이 한 번만 지급합니다. */
function awardMissionPoints() {
  if (walletState.completedMissionIds.includes(TODAY_MISSION_ID)) {
    showToast("오늘 미션 보상은 이미 지급되었어요.");
    return false;
  }

  walletState.balance += 120;
  walletState.completedMissionIds.push(TODAY_MISSION_ID);
  walletState.transactions.unshift({
    id: `point-${Date.now()}`,
    type: "earn",
    amount: 120,
    title: "26°C 절전 냉방 미션 성공",
    date: "2026. 8. 11. 오늘",
  });
  saveWalletState();
  renderWallet();
  renderProfile();
  return true;
}

/** 현재 에어컨 데이터가 오늘의 미션 조건을 만족하는지 확인합니다. */
function getMissionConditions() {
  return {
    power: airconState.power,
    mode: airconState.mode === "냉방" && airconState.power,
    temperature: airconState.temperature >= 26,
    device: !airconState.issue,
  };
}

/** 조건 위반 원인을 사용자가 이해하기 쉬운 문장으로 반환합니다. */
function getMissionViolationMessage(conditions) {
  if (!conditions.power) return "에어컨 전원이 꺼져 있어요. POWER를 켜 주세요.";
  if (!conditions.mode) return "냉방 MODE가 아니에요. 냉방 운전을 유지해 주세요.";
  if (!conditions.temperature) return "설정 온도가 26°C보다 낮아요. 26°C 이상으로 복구해 주세요.";
  if (!conditions.device) return `${airconState.issue} 상태예요. 기기를 정상 상태로 복구해 주세요.`;
  return "";
}

/** 미션 참여 상태, 조건 표시, 진행률, 성공/실패 UI를 한 번에 갱신합니다. */
function renderMission() {
  const conditions = getMissionConditions();
  const violationMessage = getMissionViolationMessage(conditions);
  const statusLabels = {
    idle: "참여 전",
    running: "진행 중",
    success: "미션 성공",
    failed: "미션 실패",
  };
  const progress = Math.min((missionState.elapsedMinutes / 120) * 100, 100);

  missionCard.classList.toggle("is-running", missionState.status === "running");
  missionCard.classList.toggle("is-success", missionState.status === "success");
  missionCard.classList.toggle("is-failed", missionState.status === "failed");
  missionCard.querySelector("[data-mission-status]").textContent = statusLabels[missionState.status];
  missionCard.querySelector("[data-mission-minutes]").textContent = missionState.elapsedMinutes;
  missionCard.querySelector("[data-mission-progress]").style.width = `${progress}%`;

  const progressbar = missionCard.querySelector("[role='progressbar']");
  progressbar.setAttribute("aria-valuenow", String(missionState.elapsedMinutes));

  Object.entries(conditions).forEach(([name, isMet]) => {
    const conditionItem = missionCard.querySelector(`[data-condition="${name}"]`);
    conditionItem.classList.toggle("is-violated", !isMet);
    conditionItem.querySelector("i").textContent = isMet ? "✓" : "!";
  });

  const warningBox = missionCard.querySelector("[data-mission-warning]");
  const shouldShowWarning = Boolean(missionState.warning || (missionState.status === "running" && violationMessage));
  warningBox.hidden = !shouldShowWarning;
  warningBox.querySelector("[data-mission-warning-text]").textContent = missionState.warning || violationMessage;
  missionCard.querySelector("[data-mission-success]").hidden = missionState.status !== "success";

  missionStartButton.innerHTML = missionState.status === "idle"
    ? '미션 참여하기 <span aria-hidden="true">→</span>'
    : missionState.status === "running"
      ? '진행 중 · 조건을 유지해 주세요 <span aria-hidden="true">●</span>'
      : '미션 다시 도전하기 <span aria-hidden="true">↻</span>';
}

/** 오늘의 미션을 처음부터 시작하거나 완료/실패 후 다시 시작합니다. */
async function startMission() {
  if (supabaseClient) {
    if (!currentUser) {
      changeScreen("my");
      showToast("미션에 참여하려면 먼저 로그인해 주세요.");
      return;
    }
    if (!activeMissionRecord) await loadSupabaseCatalogs();
    if (!activeMissionRecord) {
      showToast("오늘의 미션을 불러오지 못했어요.");
      return;
    }

    const { data, error } = await supabaseClient.rpc("start_green_mission", {
      p_mission_id: activeMissionRecord.id,
    });
    if (error) {
      console.error("미션 시작에 실패했습니다.", error);
      showToast("미션을 시작하지 못했어요. 다시 시도해 주세요.");
      return;
    }

    activeUserMissionId = data?.[0]?.user_mission_id ?? null;
    missionState.status = "running";
    missionState.elapsedMinutes = 0;
    missionState.warning = "";
    renderMission();
    showToast("GREEN MISSION을 시작했어요!");
    return;
  }

  missionState.status = "running";
  missionState.elapsedMinutes = 0;
  missionState.warning = "";
  renderMission();
  showToast("GREEN MISSION을 시작했어요!");
}

/** 가상 시간을 30분 진행하고 조건 위반 또는 성공 여부를 판정합니다. */
async function advanceMissionTime() {
  if (missionState.status !== "running") {
    showToast("먼저 미션 참여하기를 눌러 주세요.");
    return;
  }

  if (supabaseClient) {
    if (!currentUser || !activeUserMissionId) {
      showToast("진행 중인 미션 정보를 찾지 못했어요.");
      return;
    }

    await persistAirconState();
    const { data, error } = await supabaseClient.rpc("advance_green_mission", {
      p_user_mission_id: activeUserMissionId,
    });
    if (error) {
      console.error("미션 진행에 실패했습니다.", error);
      showToast("미션 진행 상태를 저장하지 못했어요.");
      return;
    }

    const result = data?.[0];
    await loadSupabaseUserData();
    if (result?.mission_status === "success") {
      showToast(result.points_awarded > 0 ? `미션 성공! GREEN POINT ${result.points_awarded}P를 받았어요.` : "오늘 미션에 성공했어요.");
    } else if (result?.mission_status === "failed") {
      showToast("미션 조건을 지키지 못했어요.");
    } else {
      showToast(`미션 시간이 ${result?.progress_minutes ?? missionState.elapsedMinutes}분으로 진행됐어요.`);
    }
    return;
  }

  const conditions = getMissionConditions();
  const violationMessage = getMissionViolationMessage(conditions);

  if (violationMessage) {
    missionState.status = "failed";
    missionState.warning = `조건 위반으로 미션이 종료됐어요. ${violationMessage}`;
    renderMission();
    showToast("미션 조건을 지키지 못했어요.");
    return;
  }

  missionState.elapsedMinutes = Math.min(missionState.elapsedMinutes + 30, 120);
  airconState.minutesUsed += 30;

  if (missionState.elapsedMinutes >= 120) {
    missionState.status = "success";
    const wasAwarded = awardMissionPoints();
    showToast(wasAwarded ? "미션 성공! GREEN POINT 120P를 받았어요." : "축하해요! GREEN MISSION에 성공했어요.");
  } else {
    showToast(`미션 시간이 ${missionState.elapsedMinutes}분으로 진행됐어요.`);
  }

  renderAirconState();
  renderMission();
}

/** 미션 조건 위반과 복구를 버튼으로 재현합니다. */
async function handleMissionSimulation(action) {
  if (action === "advance") {
    await advanceMissionTime();
    return;
  }

  if (action === "violate") {
    airconState.temperature = 23;
    missionState.warning = missionState.status === "running"
      ? "설정 온도가 23°C로 내려갔어요. 다음 시간 진행 전에 26°C 이상으로 복구해 주세요."
      : "현재 설정 온도가 미션 기준보다 낮아요.";
    showToast("23°C 조건 위반 상태를 만들었어요.");
  }

  if (action === "restore") {
    Object.assign(airconState, { power: true, mode: "냉방", temperature: 26, filter: "깨끗함", sensor: "정상", issue: null });
    missionState.warning = "";
    showToast("미션 조건을 모두 복구했어요.");
  }

  renderAirconState();
  renderMission();
  await persistAirconState();
}

/** 분 단위 사용 시간을 사용자가 읽기 쉬운 한글 문구로 바꿉니다. */
function formatUsageTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) return `${remainingMinutes}분`;
  if (remainingMinutes === 0) return `${hours}시간`;
  return `${hours}시간 ${remainingMinutes}분`;
}

/**
 * 현재 가상 데이터에 따라 에어컨 상세 카드와 홈 요약 카드를 함께 갱신합니다.
 * 비정상 상태일 때만 is-danger 클래스를 붙여 Red 계열 UI를 사용합니다.
 */
function renderAirconState() {
  const isDanger = Boolean(airconState.issue);
  const statusText = airconState.issue ?? (airconState.power ? "정상 운전" : "전원 꺼짐");
  const message = airconState.issue
    ? airconState.issue === "필터 점검 필요"
      ? "필터 상태가 좋지 않아요. 청소 후 다시 확인해 주세요."
      : "온도 센서 응답이 없어요. 안전을 위해 운전을 확인해 주세요."
    : airconState.power
      ? "쾌적한 절전 냉방을 유지하고 있어요."
      : "현재 운전을 쉬고 있어 에너지를 절약 중이에요.";

  airconCard.classList.toggle("is-danger", isDanger);
  airconSummary.classList.toggle("is-danger", isDanger);
  airconCard.querySelector("[data-device-status] span").textContent = statusText;
  airconCard.querySelector("[data-aircon-temperature]").textContent = airconState.temperature;
  airconCard.querySelector("[data-aircon-message]").textContent = message;
  airconCard.querySelector("[data-aircon-power]").textContent = airconState.power ? "ON" : "OFF";
  airconCard.querySelector("[data-aircon-mode]").textContent = airconState.power ? airconState.mode : "대기";
  airconCard.querySelector("[data-aircon-fan]").textContent = airconState.power ? airconState.fan : "정지";
  airconCard.querySelector("[data-aircon-hours]").textContent = formatUsageTime(airconState.minutesUsed);
  airconCard.querySelector("[data-aircon-filter]").textContent = airconState.filter;
  airconCard.querySelector("[data-aircon-sensor]").textContent = airconState.sensor;
  airconSummary.querySelector("[data-summary-power]").textContent = statusText;
  airconSummary.querySelector("[data-summary-detail]").textContent = isDanger
    ? message
    : airconState.power
      ? `${airconState.mode} ${airconState.temperature}°C · ${airconState.fan}`
      : "에너지 절약 대기 중";
}

/** 시뮬레이션 버튼에 따라 가상 상태를 안전하게 변경합니다. */
async function simulateAircon(type) {
  if (type === "normal") {
    Object.assign(airconState, { power: true, filter: "깨끗함", sensor: "정상", issue: null });
    showToast("에어컨이 정상 운전 상태로 돌아왔어요.");
  }

  if (type === "filter") {
    Object.assign(airconState, { filter: "점검 필요", issue: "필터 점검 필요" });
    showToast("필터 점검이 필요한 상태를 시뮬레이션했어요.");
  }

  if (type === "sensor") {
    Object.assign(airconState, { sensor: "오류", issue: "센서 오류" });
    showToast("센서 오류 상태를 시뮬레이션했어요.");
  }

  if (type === "power") {
    airconState.power = !airconState.power;
    airconState.issue = null;
    airconState.filter = "깨끗함";
    airconState.sensor = "정상";
    showToast(airconState.power ? "가상 에어컨을 켰어요." : "가상 에어컨을 껐어요.");
  }

  renderAirconState();
  renderMission();
  await persistAirconState();
}

/**
 * 짧은 안내 문구를 화면 아래에 보여줍니다.
 * 이후 경고/오류 알림은 별도의 Red UI로 확장할 예정입니다.
 */
function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("is-visible");

  toastTimer = window.setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 2200);
}

/**
 * 선택한 메뉴의 화면만 표시하고 하단 내비게이션의 활성 상태를 바꿉니다.
 * PHASE 1에서는 홈을 완성하고 나머지 메뉴에는 다음 단계 안내 화면을 둡니다.
 */
function changeScreen(targetName) {
  screens.forEach((screen) => {
    const isTarget = screen.dataset.screen === targetName;
    screen.hidden = !isTarget;
    screen.classList.toggle("is-active", isTarget);
  });

  navigationButtons.forEach((button) => {
    const isActive = button.dataset.target === targetName;
    button.classList.toggle("is-active", isActive);

    if (isActive) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
  });

  // 주소의 해시를 함께 바꿔 새로고침 후에도 현재 메뉴를 유지합니다.
  window.history.replaceState(null, "", `#${targetName}`);
  document.querySelector(`[data-screen="${targetName}"] h1`)?.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

navigationButtons.forEach((button) => {
  button.addEventListener("click", () => changeScreen(button.dataset.target));
});

shortcutButtons.forEach((button) => {
  button.addEventListener("click", () => changeScreen(button.dataset.goTo));
});

notificationButton.addEventListener("click", () => {
  showToast("새로운 알림은 아직 없어요.");
});

simulationButtons.forEach((button) => {
  button.addEventListener("click", () => simulateAircon(button.dataset.simulation));
});

missionStartButton.addEventListener("click", startMission);

missionActionButtons.forEach((button) => {
  button.addEventListener("click", () => handleMissionSimulation(button.dataset.missionAction));
});

categoryButtons.forEach((button) => {
  button.addEventListener("click", () => {
    selectedCategory = button.dataset.category;
    categoryButtons.forEach((categoryButton) => {
      const isActive = categoryButton === button;
      categoryButton.classList.toggle("is-active", isActive);
      categoryButton.setAttribute("aria-selected", String(isActive));
    });
    renderRewards();
  });
});

rewardList.addEventListener("click", (event) => {
  const detailButton = event.target.closest("[data-reward-id]");
  if (detailButton) openRewardDialog(detailButton.dataset.rewardId);
});

rewardDialogClose.addEventListener("click", () => rewardDialog.close());
purchaseButton.addEventListener("click", purchaseSelectedReward);

authModeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    authMode = button.dataset.authMode;
    renderAuthMode();
  });
});

authForm.addEventListener("submit", handleAuthSubmit);
logoutButton.addEventListener("click", logoutUser);

// 직접 입력한 해시가 유효하면 해당 화면으로 시작하고, 아니면 홈을 보여줍니다.
const initialScreen = window.location.hash.replace("#", "");
const validScreenNames = [...screens].map((screen) => screen.dataset.screen);
changeScreen(validScreenNames.includes(initialScreen) ? initialScreen : "home");
document.querySelector("[data-today-label]").textContent = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "long",
}).format(new Date());
renderWeather();
loadCurrentWeather();
renderAirconState();
renderMission();
renderWallet();
renderRewards();
renderOrders();
renderAuthMode();
renderProfile();
initializeSupabaseAuth();

// QA 검증 시 ?simulation=filter처럼 주소에 상태를 지정해 바로 확인할 수 있습니다.
const simulationPreview = new URLSearchParams(window.location.search).get("simulation");
if (!supabaseClient && ["normal", "filter", "sensor", "power"].includes(simulationPreview)) {
  simulateAircon(simulationPreview);
}

// ?mission=success 또는 ?mission=failed로 완료/실패 화면을 빠르게 회귀 검사할 수 있습니다.
const missionPreview = new URLSearchParams(window.location.search).get("mission");
if (!supabaseClient && missionPreview === "success") {
  startMission();
  for (let step = 0; step < 4; step += 1) advanceMissionTime();
}
if (!supabaseClient && missionPreview === "failed") {
  startMission();
  handleMissionSimulation("violate");
  advanceMissionTime();
}

// ?purchase=상품ID를 사용하면 구매 성공 또는 포인트 부족 화면을 빠르게 검증할 수 있습니다.
const purchasePreview = new URLSearchParams(window.location.search).get("purchase");
if (!supabaseClient && purchasePreview && rewards.some((reward) => reward.id === purchasePreview)) {
  openRewardDialog(purchasePreview);
  purchaseSelectedReward();
}

// ?demoUser=1로 인증된 MY 화면과 GREEN REPORT를 빠르게 확인할 수 있습니다.
if (!supabaseClient && new URLSearchParams(window.location.search).get("demoUser") === "1") {
  currentUser = { name: "그린온", email: "greenon@example.com" };
  renderProfile();
}
