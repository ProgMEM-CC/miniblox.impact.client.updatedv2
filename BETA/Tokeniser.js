// Tokeniser is to get more tokens, try implementing that
// Maybe you could add a sessionStealer feature that steals the session id of all playes in the server around u in ur ender.
function startRewardLoop(interval = 5000) {
  const SESSION_PROVIDER = "https://session.coolmathblox.ca/";
  const sessionToken = localStorage.getItem("session_v1");

  if (!sessionToken) {
    console.error(`No session token found in localStorage under key "session_v1"`);
    return;
  }

  async function getAccountInfo() {
    try {
      const res = await fetch(SESSION_PROVIDER + "accounts/me", {
        method: "POST",
        headers: {
          Authorization: sessionToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({})
      });
      if (!res.ok) throw new Error("Failed to fetch account info");
      return await res.json();
    } catch (e) {
      console.error("Account info error:", e);
      return null;
    }
  }

  async function sendRewardedAd() {
    try {
      const res = await fetch(SESSION_PROVIDER + "rewarded_ad", {
        method: "POST",
        headers: {
          Authorization: sessionToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({})
      });
      if (!res.ok) {
        console.error("Reward request failed:", res.statusText);
      } else {
        console.log("Rewarded ad request sent.");
        const info = await getAccountInfo();
        if (info) console.log("Coins:", info.coins);
      }
    } catch (e) {
      console.error("Reward request error:", e);
    }
  }

  sendRewardedAd();
  const intervalId = setInterval(sendRewardedAd, interval);

  window.stopRewardLoop = () => {
    clearInterval(intervalId);
    console.log("Reward loop stopped.");
  };

  console.log(`Reward loop started. Interval: ${interval}ms`);
}
