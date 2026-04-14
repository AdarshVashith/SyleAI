import { BottomTabNav, TopTabNav } from "../components/TabNav";

function Wardrobe() {
  return (
    <main className="min-h-screen bg-gray-50 px-4 pb-28 pt-6 md:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">Wardrobe</h1>
        <TopTabNav />
        <section className="rounded-2xl border border-gray-200 bg-white p-6 text-gray-600">
          Wardrobe page coming soon.
        </section>
      </div>
      <BottomTabNav />
    </main>
  );
}

export default Wardrobe;
