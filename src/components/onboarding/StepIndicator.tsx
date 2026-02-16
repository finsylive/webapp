"use client";

import React from 'react';

interface StepIndicatorProps {
    currentStep: number;
    totalSteps: number;
    labels?: string[];
}

export function StepIndicator({ currentStep, totalSteps, labels }: StepIndicatorProps) {
    return (
        <div className="w-full mb-8">
            {/* Progress bar */}
            <div className="flex items-center gap-2 mb-3">
                {Array.from({ length: totalSteps }, (_, i) => {
                    const step = i + 1;
                    const isComplete = step < currentStep;
                    const isActive = step === currentStep;

                    return (
                        <React.Fragment key={step}>
                            {/* Step circle */}
                            <div
                                className={`
                  flex items-center justify-center w-9 h-9 rounded-full text-sm font-semibold transition-all duration-300
                  ${isComplete
                                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                                        : isActive
                                            ? 'bg-emerald-500/20 text-emerald-400 ring-2 ring-emerald-500 shadow-lg shadow-emerald-500/20'
                                            : 'bg-muted text-muted-foreground'
                                    }
                `}
                            >
                                {isComplete ? (
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                ) : (
                                    step
                                )}
                            </div>
                            {/* Connector line */}
                            {step < totalSteps && (
                                <div className="flex-1 h-1 rounded-full overflow-hidden bg-muted">
                                    <div
                                        className={`h-full rounded-full transition-all duration-500 ${isComplete ? 'bg-emerald-500 w-full' : 'bg-transparent w-0'
                                            }`}
                                    />
                                </div>
                            )}
                        </React.Fragment>
                    );
                })}
            </div>

            {/* Step labels */}
            {labels && labels.length > 0 && (
                <div className="flex justify-between">
                    {labels.map((label, i) => {
                        const step = i + 1;
                        const isActive = step === currentStep;
                        const isComplete = step < currentStep;
                        return (
                            <span
                                key={label}
                                className={`text-xs font-medium transition-colors ${isActive ? 'text-emerald-400' : isComplete ? 'text-foreground' : 'text-muted-foreground'
                                    }`}
                            >
                                {label}
                            </span>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
