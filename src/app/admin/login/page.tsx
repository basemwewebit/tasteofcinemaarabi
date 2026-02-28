"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./login.module.css";

function AdminLoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg("");
        setIsLoading(true);

        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ username, password }),
            });

            const data = await res.json();

            if (res.ok && data.ok) {
                const redirectUrl = searchParams.get("redirect") ?? "/articles";
                router.push(redirectUrl);
            } else {
                setErrorMsg(data.error || "حدث خطأ غير متوقع");
                setIsLoading(false);
            }
        } catch {
            setErrorMsg("الرجاء التحقق من اتصالك بالإنترنت");
            setIsLoading(false);
        }
    };

    return (
        <div className={styles.container} dir="rtl">
            <main className={styles.card}>
                <div className={styles.header}>
                    <h1 className={styles.title}>مذاق السينما</h1>
                    <p className={styles.subtitle}>لوحة تحكم الإدارة</p>
                </div>

                <form className={styles.form} onSubmit={handleSubmit}>
                    {errorMsg && <div className={styles.error} role="alert">{errorMsg}</div>}

                    <div className={styles.field}>
                        <label htmlFor="username" className={styles.label}>
                            اسم المستخدم
                        </label>
                        <input
                            id="username"
                            type="text"
                            required
                            className={styles.input}
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            disabled={isLoading}
                            dir="ltr"
                            autoComplete="username"
                        />
                    </div>

                    <div className={styles.field}>
                        <label htmlFor="password" className={styles.label}>
                            كلمة المرور
                        </label>
                        <input
                            id="password"
                            type="password"
                            required
                            className={styles.input}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={isLoading}
                            dir="ltr"
                            autoComplete="current-password"
                        />
                    </div>

                    <button
                        type="submit"
                        className={styles.button}
                        disabled={isLoading}
                    >
                        {isLoading ? "جارٍ التحقق..." : "دخول"}
                    </button>
                </form>
            </main>
        </div>
    );
}

function LoginFallback() {
    return (
        <div className={styles.container} dir="rtl">
            <main className={styles.card}>
                <p className={styles.subtitle}>جارٍ التحميل...</p>
            </main>
        </div>
    );
}

export default function AdminLoginPage() {
    return (
        <Suspense fallback={<LoginFallback />}>
            <AdminLoginForm />
        </Suspense>
    );
}
