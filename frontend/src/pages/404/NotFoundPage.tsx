import { Link } from "react-router-dom";

const NotFoundPage = () => {
    return (
        <main className="min-h-[calc(100vh-4rem)] bg-black text-foreground">
            <section className="mx-auto flex h-full max-w-3xl flex-col items-center justify-center px-6 py-16 text-center">
                <p className="text-sm font-medium tracking-widest text-muted-foreground">
                    ERROR 404
                </p>

                <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">
                    Page not found
                </h1>

                <p className="mt-4 max-w-md text-sm text-muted-foreground sm:text-base">
                    The page you are looking for does not exist or has been moved.
                </p>

                <div className="mt-8 flex items-center gap-3">
                    <Link
                        to="/"
                        className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                        Go to Home
                    </Link>
                    <button
                        type="button"
                        onClick={() => window.history.back()}
                        className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-background px-5 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                        Go Back
                    </button>
                </div>
            </section>
        </main>
    );
};

export default NotFoundPage;