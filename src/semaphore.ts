type AsyncFn<R> = () => Promise<R>;

interface Semaphore {
    withLock<R>(fn: AsyncFn<R>): AsyncFn<R>;
    callWithLock<R>(fn: AsyncFn<R>): Promise<R>;
}

export const createSemaphore = (limit: number): Semaphore => {
    let running = 0;
    const stack: AsyncFn<any>[] = [];

    const runFn = <R>(fn: AsyncFn<R>): Promise<R> => {
        running += 1;

        return fn().then(result => {
            running -= 1;

            if (stack.length !== 0) {
                const scheduledFn = stack[stack.length - 1];
                stack.pop();

                scheduledFn();
            }

            return result;
        })
    }

    const callWithLock: Semaphore['callWithLock'] = (fn) => new Promise((resolve, reject) => {
        if (running < limit) {
            return runFn(fn).then(resolve).catch(reject);
        }

        stack.push(() => runFn(fn).then(resolve).catch(reject));
    });

    return {
        callWithLock,
        withLock: (fn) => () => callWithLock(fn),
    }
}
