"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Phone, ChevronDown, ChevronUp, MapPin, Star, Calendar } from "lucide-react";

interface CallModalProps {
  isOpen: boolean;
  onClose: () => void;
  facility: {
    facilityName: string;
    phone: string;
    sports: string[];
    priority: string;
    leadScore: number;
    lastContact: string;
  };
}

export default function CallModal({ isOpen, onClose, facility }: CallModalProps) {
  const [callNotes, setCallNotes] = useState("");
  const [selectedOutcome, setSelectedOutcome] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [showScript, setShowScript] = useState(true);

  const handleCompleteCall = () => {
    console.log("Call completed with:", {
      outcome: selectedOutcome,
      notes: callNotes,
      nextAction,
    });
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl bg-white rounded-2xl shadow-2xl z-50 max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-gradient-to-r from-green-50 to-emerald-50">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-600 rounded-xl">
                  <Phone className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{facility.facilityName}</h2>
                  <a
                    href={`tel:${facility.phone}`}
                    className="text-sm text-green-600 hover:text-green-700 font-semibold"
                  >
                    {facility.phone}
                  </a>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-slate-500 hover:text-slate-700 hover:bg-white rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Facility Quick Info */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-slate-500 font-medium mb-1">Sports Offered</p>
                  <div className="flex flex-wrap gap-1">
                    {facility.sports.map((sport) => (
                      <span
                        key={sport}
                        className="text-xs bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded border border-blue-100"
                      >
                        {sport}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-slate-500 font-medium mb-1">Lead Score</p>
                  <p className="text-lg font-bold text-slate-900">{facility.leadScore}</p>
                </div>
                <div>
                  <p className="text-slate-500 font-medium mb-1">Last Contact</p>
                  <p className="text-slate-900 font-semibold">{facility.lastContact}</p>
                </div>
              </div>
            </div>

            {/* Call Script Section */}
            <div className="p-6 border-b border-slate-200">
              <button
                onClick={() => setShowScript(!showScript)}
                className="flex items-center justify-between w-full mb-3 p-3 rounded-xl hover:bg-slate-50 transition-colors"
              >
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Call Script
                </h3>
                {showScript ? (
                  <ChevronUp className="h-4 w-4 text-slate-500" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-slate-500" />
                )}
              </button>

              <AnimatePresence>
                {showScript && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="space-y-4 overflow-hidden"
                  >
                    {/* Introduction */}
                    <div className="p-4 bg-blue-50 border-l-4 border-blue-600 rounded-r-lg">
                      <h4 className="text-sm font-bold text-blue-900 mb-2">1. Introduction</h4>
                      <p className="text-sm text-slate-700 leading-relaxed">
                        "Hi, is this <span className="font-semibold">{facility.facilityName}</span>?
                        Great! My name is [Your Name] and I'm calling from Texas Sports Academy.
                        Do you have a quick moment to chat about a partnership opportunity?"
                      </p>
                    </div>

                    {/* Value Proposition */}
                    <div className="p-4 bg-green-50 border-l-4 border-green-600 rounded-r-lg">
                      <h4 className="text-sm font-bold text-green-900 mb-2">2. Value Proposition</h4>
                      <p className="text-sm text-slate-700 leading-relaxed">
                        "We work with facilities like yours to run after-school and weekend sports programs.
                        I noticed you offer <span className="font-semibold">{facility.sports.join(", ")}</span> -
                        that's perfect! We handle all the marketing, coaching, and operations, and we help facilities
                        increase their revenue by 25-40% on average."
                      </p>
                    </div>

                    {/* Discovery Questions */}
                    <div className="p-4 bg-purple-50 border-l-4 border-purple-600 rounded-r-lg">
                      <h4 className="text-sm font-bold text-purple-900 mb-2">3. Discovery Questions</h4>
                      <ul className="text-sm text-slate-700 space-y-2 leading-relaxed">
                        <li>• "Are you currently running any youth sports programs?"</li>
                        <li>• "What times are your facilities typically underutilized?"</li>
                        <li>• "Are you open to exploring additional revenue streams?"</li>
                      </ul>
                    </div>

                    {/* Next Steps */}
                    <div className="p-4 bg-amber-50 border-l-4 border-amber-600 rounded-r-lg">
                      <h4 className="text-sm font-bold text-amber-900 mb-2">4. Close & Next Steps</h4>
                      <p className="text-sm text-slate-700 leading-relaxed">
                        "This sounds like a great fit! I'd love to schedule a brief 15-minute call with our
                        partnership team to go over the specifics. Do you have time this week - perhaps
                        Thursday at 2pm or Friday at 10am?"
                      </p>
                    </div>

                    {/* Objection Handling */}
                    <div className="p-4 bg-red-50 border-l-4 border-red-600 rounded-r-lg">
                      <h4 className="text-sm font-bold text-red-900 mb-2">Common Objections</h4>
                      <div className="text-sm text-slate-700 space-y-2 leading-relaxed">
                        <p><span className="font-semibold">"We're too busy":</span> "That's exactly why our model works - we handle everything so there's minimal work on your end."</p>
                        <p><span className="font-semibold">"Not interested":</span> "I understand. Can I ask what your main concern is? Many of our partners had the same initial hesitation."</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Call Logging */}
            <div className="p-6 space-y-6">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Log Call Outcome
              </h3>

              {/* Outcome Selection */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">
                  Call Outcome *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: "interested", label: "Interested", color: "green" },
                    { value: "not-interested", label: "Not Interested", color: "red" },
                    { value: "no-answer", label: "No Answer", color: "gray" },
                    { value: "callback", label: "Callback Scheduled", color: "blue" },
                  ].map((outcome) => (
                    <button
                      key={outcome.value}
                      onClick={() => setSelectedOutcome(outcome.value)}
                      className={`p-3 rounded-lg border-2 text-sm font-semibold transition-all ${
                        selectedOutcome === outcome.value
                          ? `border-${outcome.color}-600 bg-${outcome.color}-50 text-${outcome.color}-700`
                          : "border-slate-200 text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      {outcome.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Call Notes */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Call Notes
                </label>
                <textarea
                  value={callNotes}
                  onChange={(e) => setCallNotes(e.target.value)}
                  placeholder="What did you discuss? Any key points or follow-up items?"
                  rows={4}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm resize-none"
                />
              </div>

              {/* Next Action */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Next Action
                </label>
                <select
                  value={nextAction}
                  onChange={(e) => setNextAction(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm bg-white"
                >
                  <option value="">Select next action...</option>
                  <option value="schedule-meeting">Schedule Follow-up Meeting</option>
                  <option value="send-proposal">Send Proposal</option>
                  <option value="send-email">Send Follow-up Email</option>
                  <option value="callback">Schedule Callback</option>
                  <option value="add-to-nurture">Add to Nurture Campaign</option>
                  <option value="mark-closed">Mark as Closed/Lost</option>
                </select>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200 bg-slate-50">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-semibold text-slate-700 hover:text-slate-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCompleteCall}
                disabled={!selectedOutcome}
                className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Phone className="h-4 w-4" />
                Complete Call
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
