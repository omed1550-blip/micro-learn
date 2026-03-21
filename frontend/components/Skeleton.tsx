"use client";

interface Props {
  width?: string;
  height?: string;
  rounded?: boolean;
  className?: string;
}

export default function Skeleton({
  width,
  height,
  rounded,
  className = "",
}: Props) {
  return (
    <div
      className={`skeleton ${rounded ? "rounded-full" : "rounded-xl"} ${className}`}
      style={{ width, height }}
    />
  );
}
