export default function ClothCard({ cloth, onTryOn, onWorn }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 
      overflow-hidden hover:shadow-md transition-all">
      
      {/* Cloth image */}
      <div className="relative">
        <img
          src={cloth.imageUrl}
          alt={cloth.name}
          className="w-full h-52 object-cover"
        />
        {/* Wear count badge */}
        <div className="absolute top-2 right-2 bg-black/70 
          text-white text-xs px-2 py-1 rounded-full">
          Worn {cloth.wearCount || 0}x
        </div>
        {/* Category tag */}
        <div className="absolute top-2 left-2 bg-white/90 
          text-gray-700 text-xs px-2 py-1 rounded-full">
          {cloth.category}
        </div>
      </div>
      
      {/* Cloth info */}
      <div className="p-3">
        <p className="font-semibold text-sm mb-1">{cloth.name}</p>
        <p className="text-xs text-gray-400 mb-3">
          Added {new Date(cloth.addedAt).toLocaleDateString()}
        </p>
        
        {/* Last worn */}
        {cloth.lastWorn && (
          <p className="text-xs text-gray-400 mb-3">
            Last worn: {new Date(cloth.lastWorn).toLocaleDateString()}
          </p>
        )}
        
        {/* Repeat cycle indicator */}
        {cloth.wearCount > 0 && (
          <div className="flex gap-1 mb-3">
            {[...Array(Math.min(cloth.wearCount, 5))].map((_, i) => (
              <div key={i} 
                className="w-2 h-2 rounded-full bg-orange-400"/>
            ))}
            {cloth.wearCount > 5 && (
              <span className="text-xs text-gray-400">
                +{cloth.wearCount - 5}
              </span>
            )}
          </div>
        )}
        
        <div className="flex gap-2">
          <button
            onClick={() => onTryOn(cloth)}
            className="flex-1 py-2 rounded-xl bg-gray-900 
              text-white text-xs font-semibold 
              hover:bg-gray-700 transition-all"
          >
            Try on
          </button>
          <button
            onClick={() => onWorn(cloth.id)}
            className="flex-1 py-2 rounded-xl border 
              border-gray-200 text-gray-600 text-xs 
              font-semibold hover:bg-gray-50 transition-all"
          >
            Worn today
          </button>
        </div>
      </div>
    </div>
  )
}
