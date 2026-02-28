"use client";

import { useRouter } from "next/navigation";
import styles from "./admin.module.css";

export function LogoutButton() {
    const router = useRouter();

    const handleLogout = async () => {
        try {
            await fetch("/api/auth/logout", { method: "POST" });
            router.push("/admin/login");
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <button onClick={handleLogout} className={styles.logoutButton}>
            تسجيل الخروج
        </button>
    );
}
