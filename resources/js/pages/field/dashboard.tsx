import { router } from "@inertiajs/react";

export default function FieldDashboard() {
    function handleLogout() {
        router.post("/logout");
    }

    return (
        <div className="min-h-screen bg-gray-100 p-8">
            <h1 className="text-3xl font-bold text-green-800">
                Welcome to Field Office Dashboard
            </h1>

            <button
                type="button"
                onClick={handleLogout}
                className="mt-6 rounded-lg bg-red-600 px-5 py-3 font-semibold text-white transition hover:bg-red-700"
            >
                Logout
            </button>
        </div>
    );
}
