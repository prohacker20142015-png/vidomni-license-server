# -*- coding: utf-8 -*-
"""
cloud_sync.py
Cloud 24/7 heartbeat and bi-directional synchronizer between Upstash Edge Database and Vercel.
Runs automatically inside GitHub Actions every 10 minutes to prevent Vercel cold wipes.
"""
import json
import logging
import sys
import requests

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("CloudSync")

VERCEL_URL = "https://vidomni-license-server.vercel.app"
VERCEL_AUTH = "Bearer admin123"
UPSTASH_URL = "https://select-wahoo-44785.upstash.io"
UPSTASH_TOKEN = "Aa7xAAIgcDEyMjI3ODQ5YTg4MTE0OTQwODI1MDhmY2JlNjA5MDU5YQ"


def get_upstash_key(key: str):
    try:
        r = requests.get(
            f"{UPSTASH_URL}/get/license:{key}",
            headers={"Authorization": f"Bearer {UPSTASH_TOKEN}"},
            timeout=10,
        )
        if r.status_code == 200:
            val = r.json().get("result")
            if val:
                return json.loads(val) if isinstance(val, str) else val
    except Exception as e:
        logger.debug("Error reading key %s from Upstash: %s", key, e)
    return None


def set_upstash_key(key: str, data: dict):
    try:
        requests.post(
            f"{UPSTASH_URL}/set/license:{key}",
            headers={"Authorization": f"Bearer {UPSTASH_TOKEN}"},
            data=json.dumps(data),
            timeout=10,
        )
        requests.get(
            f"{UPSTASH_URL}/sadd/licenses:index/{key}",
            headers={"Authorization": f"Bearer {UPSTASH_TOKEN}"},
            timeout=10,
        )
        return True
    except Exception as e:
        logger.warning("Error writing key %s to Upstash: %s", key, e)
        return False


def set_vercel_key(data: dict):
    try:
        r = requests.post(
            f"{VERCEL_URL}/api/admin/keys",
            headers={"Authorization": VERCEL_AUTH},
            json={
                "custom_key": data.get("key"),
                "tier": data.get("tier", "pro"),
                "duration_days": data.get("duration_days", 30),
                "max_accounts": data.get("max_accounts", 10),
                "max_concurrent_jobs": data.get("max_concurrent_jobs", 3),
                "machine_id": data.get("bound_machine_id") or "",
                "customer_phone": data.get("customer_phone") or "",
                "customer_email": data.get("customer_email") or "",
                "notes": data.get("notes") or "",
            },
            timeout=10,
        )
        return r.status_code == 200
    except Exception as e:
        logger.warning("Error writing key %s to Vercel: %s", data.get("key"), e)
        return False


def sync():
    # 1. Read Upstash keys
    upstash_keys = set()
    try:
        r_up = requests.get(
            f"{UPSTASH_URL}/smembers/licenses:index",
            headers={"Authorization": f"Bearer {UPSTASH_TOKEN}"},
            timeout=10,
        )
        if r_up.status_code == 200:
            res_val = r_up.json().get("result") or []
            for x in res_val:
                if x:
                    upstash_keys.add(str(x).strip().upper())
    except Exception as e:
        logger.warning("Error reading Upstash index: %s", e)

    try:
        r_keys = requests.get(
            f"{UPSTASH_URL}/keys/license:*",
            headers={"Authorization": f"Bearer {UPSTASH_TOKEN}"},
            timeout=10,
        )
        if r_keys.status_code == 200:
            res_k = r_keys.json().get("result") or []
            for k in res_k:
                if k:
                    upstash_keys.add(str(k).replace("license:", "").strip().upper())
    except Exception as e:
        logger.warning("Error scanning Upstash keys: %s", e)

    logger.info("Found %d keys in Upstash Cloud Database.", len(upstash_keys))

    # 2. Read Vercel keys
    ver_key_map = {}
    try:
        r_ver = requests.get(
            f"{VERCEL_URL}/api/admin/keys",
            headers={"Authorization": VERCEL_AUTH},
            timeout=15,
        )
        if r_ver.status_code == 200:
            ver_keys = r_ver.json().get("keys", [])
            ver_key_map = {k["key"].upper(): k for k in ver_keys if k and k.get("key")}
            logger.info("Found %d keys currently alive on Vercel.", len(ver_key_map))
        else:
            logger.warning("Vercel returned status %s", r_ver.status_code)
    except Exception as e:
        logger.warning("Error connecting to Vercel: %s", e)

    all_keys = set(ver_key_map.keys()).union(upstash_keys)
    synced_count = 0

    for k_name in all_keys:
        if not k_name:
            continue
        v_data = ver_key_map.get(k_name)
        u_data = get_upstash_key(k_name) if k_name in upstash_keys else None

        if v_data and not u_data:
            set_upstash_key(k_name, v_data)
            synced_count += 1
            logger.info("[Vercel -> Upstash] Saved new key: %s", k_name)
            continue

        if u_data and not v_data:
            set_vercel_key(u_data)
            synced_count += 1
            logger.info("[Upstash -> Vercel] Restored key: %s", k_name)
            continue

        if v_data and u_data:
            v_hwid = (v_data.get("bound_machine_id") or "").strip()
            u_hwid = (u_data.get("bound_machine_id") or "").strip()

            if v_hwid and not u_hwid:
                u_data["bound_machine_id"] = v_hwid
                u_data["status"] = "active"
                if v_data.get("activated_at"):
                    u_data["activated_at"] = v_data["activated_at"]
                if v_data.get("expires_at"):
                    u_data["expires_at"] = v_data["expires_at"]
                if v_data.get("customer_phone"):
                    u_data["customer_phone"] = v_data["customer_phone"]
                if v_data.get("customer_email"):
                    u_data["customer_email"] = v_data["customer_email"]
                set_upstash_key(k_name, u_data)
                synced_count += 1
                logger.info("[Activation] Synced bound HWID to Upstash for %s", k_name)
                continue

            if u_hwid and not v_hwid:
                set_vercel_key(u_data)
                synced_count += 1
                logger.info("[Activation] Assigned HWID to Vercel for %s", k_name)
                continue

            if (v_data.get("status") == "revoked" and u_data.get("status") != "revoked"):
                u_data["status"] = "revoked"
                set_upstash_key(k_name, u_data)
                synced_count += 1
                logger.info("[Revoke] Revoked key %s on Upstash", k_name)
                continue

            if (u_data.get("status") == "revoked" and v_data.get("status") != "revoked"):
                try:
                    requests.post(
                        f"{VERCEL_URL}/api/admin/keys/action",
                        headers={"Authorization": VERCEL_AUTH},
                        json={"key": k_name, "action": "revoke"},
                        timeout=8,
                    )
                    synced_count += 1
                    logger.info("[Revoke] Revoked key %s on Vercel", k_name)
                except Exception:
                    pass
                continue

            u_tier = str(u_data.get("tier") or "").lower()
            v_tier = str(v_data.get("tier") or "").lower()
            u_acc = int(u_data.get("max_accounts") or 0)
            v_acc = int(v_data.get("max_accounts") or 0)
            u_th = int(u_data.get("max_concurrent_jobs") or 0)
            v_th = int(v_data.get("max_concurrent_jobs") or 0)

            if u_tier != v_tier or u_acc != v_acc or u_th != v_th:
                target_tier = "vip" if "vip" in (u_tier, v_tier) else ("pro" if "pro" in (u_tier, v_tier) else "standard")
                target_acc = max(u_acc, v_acc)
                target_th = max(u_th, v_th)
                merged = dict(u_data)
                merged["tier"] = target_tier
                merged["max_accounts"] = target_acc
                merged["max_concurrent_jobs"] = target_th
                set_upstash_key(k_name, merged)
                set_vercel_key(merged)
                synced_count += 1
                logger.info("[Config] Synced specs (%s, %d acc, %d th) for %s", target_tier, target_acc, target_th, k_name)

    logger.info("Sync finished. Total synced/updated keys: %d", synced_count)


if __name__ == "__main__":
    sync()
