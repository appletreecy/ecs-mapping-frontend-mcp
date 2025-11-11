import { NavLink, Route, Routes } from "react-router-dom";
import MapFromJsonPage from "./pages/MapFromJsonPage";
import MappingsListPage from "./pages/MappingsListPage";

export default function App() {
    return (
        <div className="min-h-screen bg-gray-50 text-gray-900">
            <header className="border-b bg-white">
                <div className="mx-auto max-w-5xl px-4 py-3 flex items-center gap-6">
                    <div className="font-bold">ECS Mapper</div>
                    <nav className="flex items-center gap-4 text-sm">
                        <NavLink
                            to="/"
                            end
                            className={({isActive}) =>
                                isActive ? "text-blue-600 font-medium" : "text-gray-600 hover:text-gray-800"
                            }
                        >
                            Map from JSON
                        </NavLink>
                        <NavLink
                            to="/mappings"
                            className={({isActive}) =>
                                isActive ? "text-blue-600 font-medium" : "text-gray-600 hover:text-gray-800"
                            }
                        >
                            Mappings List
                        </NavLink>
                    </nav>
                </div>
            </header>

            <main className="px-4 py-6 flex justify-center">
                <div className="w-full max-w-[92rem]">
                    <Routes>
                        <Route path="/" element={<MapFromJsonPage />} />
                        <Route path="/mappings" element={<MappingsListPage />} />
                    </Routes>
                </div>
            </main>

        </div>
    );
}
