# -*- coding: utf-8 -*-
"""
cloud_sync.py
Cloud 24/7 heartbeat and bi-directional synchronizer between Upstash Edge Database and Vercel.
Runs automatically inside GitHub Actions every 15 minutes to prevent Vercel cold wipes.
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
                upstash_keys.add(str(x).upper())
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

    # 3. Restore all keys from Upstash -> Vercel
    restored = 0
    for u_k in upstash_keys:
        if not u_k:
            continue
        try:
            r_get = requests.get(
                f"{UPSTASH_URL}/get/license:{u_k}",
                headers={"Authorization": f"Bearer {UPSTASH_TOKEN}"},
                timeout=10,
            )
            if r_get.status_code == 200:
                raw_val = r_get.json().get("result")
                if raw_val:
                    u_data = json.loads(raw_val) if isinstance(raw_val, str) else raw_val
                    u_tier = str(u_data.get("tier") or "pro").lower()
                    u_acc = int(u_data.get("max_accounts") or (1 if u_tier == "standard" else (20 if u_tier == "pro" else 100)))
                    u_th = int(u_data.get("max_concurrent_jobs") or (5 if u_tier == "standard" else (10 if u_tier == "pro" else 50)))
                    u_hwid = u_data.get("bound_machine_id") or ""

                    ver_item = ver_key_map.get(u_k)
                    needs_update = False
                    if not ver_item:
                        needs_update = True
                    else:
                        v_tier = str(ver_item.get("tier") or "").lower()
                        v_acc = int(ver_item.get("max_accounts") or 0)
                        v_th = int(ver_item.get("max_concurrent_jobs") or 0)
                        v_hwid = ver_item.get("bound_machine_id") or ""
                        if u_tier != v_tier or u_acc != v_acc or u_th != v_th or u_hwid != v_hwid:
                            needs_update = True

                    if needs_update:
                        requests.post(
                            f"{VERCEL_URL}/api/admin/keys",
                            headers={"Authorization": VERCEL_AUTH},
                            json={
                                "custom_key": u_data.get("key", u_k),
                                "tier": u_tier,
                                "duration_days": u_data.get("duration_days", 30),
                                "max_accounts": u_acc,
                                "max_concurrent_jobs": u_th,
                                "machine_id": u_hwid,
                                "customer_phone": u_data.get("customer_phone") or "",
                                "customer_email": u_data.get("customer_email") or "",
                            },
                            timeout=10,
                        )
                        restored += 1
                        logger.info("Restored/Synced key to Vercel: %s", u_k)
        except Exception as e:
            logger.warning("Error restoring key %s: %s", u_k, e)

    # 4. Save any new keys created on Vercel back to Upstash
    synced_to_upstash = 0
    for k_name, k_data in ver_key_map.items():
        if k_name not in upstash_keys:
            try:
                requests.post(
                    f"{UPSTASH_URL}/set/license:{k_name}",
                    headers={"Authorization": f"Bearer {UPSTASH_TOKEN}"},
                    data=json.dumps(k_data),
                    timeout=10,
                )
                requests.get(
                    f"{UPSTASH_URL}/sadd/licenses:index/{k_name}",
                    headers={"Authorization": f"Bearer {UPSTASH_TOKEN}"},
                    timeout=10,
                )
                synced_to_upstash += 1
                logger.info("Saved new Vercel key to Upstash: %s", k_name)
            except Exception as e:
                logger.warning("Error saving key %s to Upstash: %s", k_name, e)

    logger.info("Sync finished. Restored to Vercel: %d, Saved to Upstash: %d", restored, synced_to_upstash)

if __name__ == "__main__":
    sync()
