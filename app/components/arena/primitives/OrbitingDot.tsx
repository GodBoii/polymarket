"use client";

import { motion } from "framer-motion";

type Props = {
  size?: number;
  duration?: number;
  delay?: number;
  radius?: number;
  color?: string;
};

export default function OrbitingDot({
  size = 4,
  duration = 6,
  delay = 0,
  radius = 60,
  color = "#00E7FF",
}: Props) {
  return (
    <motion.div
      className="absolute"
      style={{ width: size, height: size }}
      animate={{ rotate: 360 }}
      transition={{ duration, repeat: Infinity, ease: "linear", delay }}
    >
      <div
        className="absolute rounded-full"
        style={{
          width: size,
          height: size,
          background: color,
          boxShadow: `0 0 ${size * 2}px ${color}`,
          left: radius,
          top: -size / 2,
        }}
      />
    </motion.div>
  );
}
