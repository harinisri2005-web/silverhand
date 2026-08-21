import React, { useState } from "react";
import {
  KeyRound,
  User as UserIcon,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  UserPlus,
  HeartHandshake,
  CheckCircle,
  X,
  Phone,
  Globe,
  MapPin,
} from "lucide-react";
import { User, UserRole } from "../types";
import {
  authenticateUser,
  getStoredUsers,
  saveUser,
  SEED_USERS,
  setCurrentUser,
} from "../services/storageService";
import { DEFAULT_USER_LOCATION } from "../services/locationService";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthenticated: (user: User) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuthenticated,
}) => {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [username, setUsername] = useState("");
  const [passcode, setPasscode] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Registration Fields
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<UserRole>("provider");
  const [preferredLanguage, setPreferredLanguage] = useState("Hindi");
  const [specialty, setSpecialty] = useState("");
  const [bio, setBio] = useState("");
  const [phone, setPhone] = useState("");

  if (!isOpen) return null;

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanUser = username.trim().toLowerCase();
    const cleanPass = passcode.trim();

    if (!cleanUser || !cleanPass) {
      setErrorMsg("Please enter both your Username and 4-digit Passcode.");
      return;
    }

    const allUsers = getStoredUsers();
    const existingUser = allUsers.find(
      (u) => u.username.toLowerCase() === cleanUser
    );

    if (!existingUser) {
      // Username not found -> dynamically transition to Create New Account as required by prompt
      setErrorMsg(
        `Username "${username}" not found. Let's create your new SilverHands account below!`
      );
      setIsRegisterMode(true);
      return;
    }

    if (existingUser.passcode !== cleanPass) {
      setErrorMsg("Incorrect 4-digit Passcode. Please check and try again.");
      return;
    }

    // Success
    setCurrentUser(existingUser);
    onAuthenticated(existingUser);
    onClose();
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!username.trim() || !passcode.trim() || !fullName.trim()) {
      setErrorMsg("Please fill in your Name, Username, and a 4-digit Passcode.");
      return;
    }

    if (passcode.trim().length < 4) {
      setErrorMsg("Passcode should be at least 4 numbers or characters.");
      return;
    }

    const newUser: User = {
      id: `user_${Date.now()}`,
      username: username.trim().toLowerCase(),
      passcode: passcode.trim(),
      fullName: fullName.trim(),
      role,
      preferredLanguage,
      phone: phone.trim() || "+1 (555) 000-1234",
      location: DEFAULT_USER_LOCATION,
      bio: bio.trim() || "Local artisan sharing authentic generational craft.",
      specialtySkills: specialty
        ? specialty.split(",").map((s) => s.trim())
        : ["Handmade Heritage"],
      digitalApprenticeWilling: role === "provider",
      rating: 5.0,
      reviewCount: 1,
      createdAt: new Date().toISOString(),
      avatarUrl:
        role === "provider"
          ? "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80"
          : "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
    };

    saveUser(newUser);
    setCurrentUser(newUser);
    onAuthenticated(newUser);
    onClose();
  };

  const handleQuickLogin = (demoUser: User) => {
    setCurrentUser(demoUser);
    onAuthenticated(demoUser);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-amber-500/30 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl text-amber-50 relative">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-amber-950/80 via-slate-900 to-slate-900 border-b border-amber-900/40 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-amber-100 font-serif">
                {isRegisterMode ? "Create New Senior Account" : "Accessible Senior Login"}
              </h2>
              <p className="text-sm text-amber-300/80">
                Simple Username & 4-Digit Passcode (No complex emails needed)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 max-h-[80vh] overflow-y-auto space-y-6">
          {errorMsg && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/40 text-amber-200 text-base">
              {errorMsg}
            </div>
          )}

          {!isRegisterMode ? (
            /* Sign In Form */
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-base font-semibold text-amber-100 mb-2">
                  Your Username
                </label>
                <div className="relative">
                  <UserIcon className="w-6 h-6 absolute left-4 top-1/2 -translate-y-1/2 text-amber-400" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. kamaladadi or your name"
                    className="w-full pl-13 pr-4 py-3.5 bg-slate-800 border-2 border-slate-700 focus:border-amber-500 rounded-2xl text-lg text-white placeholder-slate-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-base font-semibold text-amber-100 mb-2">
                  4-Digit Passcode
                </label>
                <div className="relative">
                  <KeyRound className="w-6 h-6 absolute left-4 top-1/2 -translate-y-1/2 text-amber-400" />
                  <input
                    type="password"
                    maxLength={8}
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    placeholder="e.g. 1234"
                    className="w-full pl-13 pr-4 py-3.5 bg-slate-800 border-2 border-slate-700 focus:border-amber-500 rounded-2xl text-lg tracking-widest text-white placeholder-slate-500 outline-none transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                id="submit-auth-btn"
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xl shadow-lg transition-all flex items-center justify-center space-x-2"
              >
                <span>Enter SilverHands</span>
                <ArrowRight className="w-6 h-6" />
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsRegisterMode(true);
                    setErrorMsg(null);
                  }}
                  className="text-base text-amber-300 hover:text-amber-200 underline font-medium"
                >
                  New here? Tap to Register a New Profile
                </button>
              </div>
            </form>
          ) : (
            /* Registration Form */
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-amber-100 mb-1.5">
                    Your Full Name
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Grandma Savitri"
                    className="w-full px-4 py-3 bg-slate-800 border-2 border-slate-700 focus:border-amber-500 rounded-xl text-base text-white outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-amber-100 mb-1.5">
                    Choose Username
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. savitri_crafts"
                    className="w-full px-4 py-3 bg-slate-800 border-2 border-slate-700 focus:border-amber-500 rounded-xl text-base text-white outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-amber-100 mb-1.5">
                    4-Digit Passcode
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    placeholder="e.g. 1234"
                    className="w-full px-4 py-3 bg-slate-800 border-2 border-slate-700 focus:border-amber-500 rounded-xl text-base tracking-widest text-white outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-amber-100 mb-1.5">
                    Phone Number (Optional)
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className="w-full px-4 py-3 bg-slate-800 border-2 border-slate-700 focus:border-amber-500 rounded-xl text-base text-white outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-amber-100 mb-1.5">
                  I want to join as:
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRole("provider")}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      role === "provider"
                        ? "bg-amber-500/20 border-amber-400 text-amber-100"
                        : "bg-slate-800 border-slate-700 text-slate-300"
                    }`}
                  >
                    <div className="font-bold text-base">Senior Artisan / Master</div>
                    <div className="text-xs text-amber-300/80">Offer skills, crafts & home goods</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRole("customer")}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      role === "customer"
                        ? "bg-amber-500/20 border-amber-400 text-amber-100"
                        : "bg-slate-800 border-slate-700 text-slate-300"
                    }`}
                  >
                    <div className="font-bold text-base">Local Neighbor / Buyer</div>
                    <div className="text-xs text-amber-300/80">Discover & support local elders</div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-amber-100 mb-1.5">
                  Preferred Native Language (Gemini AI will translate automatically)
                </label>
                <select
                  value={preferredLanguage}
                  onChange={(e) => setPreferredLanguage(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800 border-2 border-slate-700 focus:border-amber-500 rounded-xl text-base text-white outline-none"
                >
                  <option value="Hindi">Hindi (हिंदी)</option>
                  <option value="Tamil">Tamil (தமிழ்)</option>
                  <option value="Telugu">Telugu (తెలుగు)</option>
                  <option value="Bengali">Bengali (বাংলা)</option>
                  <option value="Marathi">Marathi (मराठी)</option>
                  <option value="Spanish">Spanish (Español)</option>
                  <option value="French">French (Français)</option>
                  <option value="English">English</option>
                </select>
              </div>

              {role === "provider" && (
                <div>
                  <label className="block text-sm font-semibold text-amber-100 mb-1.5">
                    Your Specialty Craft / Service
                  </label>
                  <input
                    type="text"
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value)}
                    placeholder="e.g. Silk sari darning, Teak woodwork, Pickles"
                    className="w-full px-4 py-3 bg-slate-800 border-2 border-slate-700 focus:border-amber-500 rounded-xl text-base text-white outline-none"
                  />
                </div>
              )}

              <button
                type="submit"
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xl shadow-lg transition-all flex items-center justify-center space-x-2"
              >
                <span>Register & Open SilverHands</span>
                <CheckCircle className="w-6 h-6" />
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsRegisterMode(false);
                    setErrorMsg(null);
                  }}
                  className="text-sm text-amber-300 hover:text-amber-200 underline"
                >
                  Already have an account? Back to Login
                </button>
              </div>
            </form>
          )}

          {/* 1-Tap Demo Switcher */}
          <div className="border-t border-slate-800 pt-5">
            <div className="text-xs uppercase tracking-wider text-amber-400 font-bold mb-3 flex items-center space-x-1.5">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>One-Tap Demo Accounts for Evaluation</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {SEED_USERS.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleQuickLogin(user)}
                  className="flex items-center space-x-3 p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/80 text-left transition-all group"
                >
                  <img
                    src={user.avatarUrl}
                    alt={user.fullName}
                    className="w-10 h-10 rounded-full object-cover border border-amber-500/50"
                    referrerPolicy="no-referrer"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-amber-100 group-hover:text-amber-300 truncate">
                      {user.fullName}
                    </div>
                    <div className="text-xs text-slate-400">
                      {user.role === "provider" ? `Artisan (${user.preferredLanguage})` : "Neighbor Customer"}
                    </div>
                  </div>
                  <span className="text-xs bg-slate-900 px-2 py-1 rounded text-amber-300/80 font-mono">
                    {user.passcode}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
