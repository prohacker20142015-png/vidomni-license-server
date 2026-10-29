# -*- coding: utf-8 -*-
"""
cloud_sync.py
Cloud 24/7 heartbeat and bi-directional synchronizer between Firebase RTDB and Vercel.
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
FIREBASE_RTDB_URL = "https://vps123-ff296-default-rtdb.firebaseio.com"

def sync():
    # 1. Read Firebase RTDB keys
    fb_key_map = {}
    try:
        r_fb = requests.get(f"{FIREBASE_RTDB_URL}/vidomni_licenses.json", timeout=12)
        if r_fb.status_code == 200:
            raw = r_fb.json() or {}
            if isinstance(raw, dict):
                for k, v in raw.items():
                    if isinstance(v, dict) and v.get("key"):
                        fb_key_map[v["key"].strip().upper()] = v
    except Exception as e:
        logger.warning("Error reading Firebase RTDB: %s", e)

    logger.info("Found %d keys in Firebase RTDB.", len(fb_key_map))

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
            ver_key_map = {k["key"].strip().upper(): k for k in ver_keys if k and k.get("key")}
            logger.info("Found %d keys currently alive on Vercel.", len(ver_key_map))
        else:
            logger.warning("Vercel returned status %s", r_ver.status_code)
    except Exception as e:
        logger.warning("Error connecting to Vercel: %s", e)

    # 3. Restore all keys from Firebase -> Vercel
    restored = 0
    for u_k, u_data in fb_key_map.items():
        try:
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
                if u_tier != v_tier or u_acc != v_acc or u_th != v_th or (u_hwid and not v_hwid):
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
                        "notes": u_data.get("notes") or "",
                    },
                    timeout=10,
                )
                restored += 1
        except Exception as e:
            logger.warning("Error restoring key %s: %s", u_k, e)

    # 4. Save any new keys created on Vercel back to Firebase RTDB
    synced_to_fb = 0
    for k_name, k_data in ver_key_map.items():
        if k_name not in fb_key_map:
            try:
                requests.put(
                    f"{FIREBASE_RTDB_URL}/vidomni_licenses/{k_name}.json",
                    json=k_data,
                    timeout=10,
                )
                synced_to_fb += 1
            except Exception as e:
                logger.warning("Error saving key %s to Firebase RTDB: %s", k_name, e)

    logger.info("Sync finished. Restored to Vercel: %d, Saved to Firebase: %d", restored, synced_to_fb)

if __name__ == "__main__":
    sync()
