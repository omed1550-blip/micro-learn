export function lightTap() {
  try {
    navigator?.vibrate?.(10);
  } catch {}
}

export function successBuzz() {
  try {
    navigator?.vibrate?.([10, 50, 10]);
  } catch {}
}

export function errorBuzz() {
  try {
    navigator?.vibrate?.([50, 30, 50]);
  } catch {}
}

export function celebrationBuzz() {
  try {
    navigator?.vibrate?.([10, 30, 10, 30, 10, 50, 20]);
  } catch {}
}
