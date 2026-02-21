import { Facility } from "@/types/facility";

interface FacilitySidebarProps {
  facility: Facility | null;
  onClose: () => void;
}

export default function FacilitySidebar({ facility, onClose }: FacilitySidebarProps) {
  if (!facility) return null;

  const getPhotoUrl = (photoReference: string) => {
    const maxWidth = 400;
    return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${photoReference}&key=${process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY}`;
  };

  const formatSportType = (type: string) => {
    return type
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    for (let i = 0; i < fullStars; i++) {
      stars.push(
        <span key={`full-${i}`} className="text-yellow-400">
          ★
        </span>
      );
    }
    if (hasHalfStar) {
      stars.push(
        <span key="half" className="text-yellow-400">
          ⯪
        </span>
      );
    }
    const remainingStars = 5 - Math.ceil(rating);
    for (let i = 0; i < remainingStars; i++) {
      stars.push(
        <span key={`empty-${i}`} className="text-gray-300">
          ★
        </span>
      );
    }
    return stars;
  };

  return (
    <div className="fixed top-0 right-0 h-full w-full md:w-[480px] bg-white shadow-2xl z-50 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex justify-between items-start">
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-900">{facility.name}</h2>
          {facility.rating && (
            <div className="flex items-center gap-2 mt-1">
              <div className="flex text-xl">{renderStars(facility.rating)}</div>
              <span className="text-sm text-gray-600">
                {facility.rating.toFixed(1)} ({facility.user_ratings_total} reviews)
              </span>
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          className="ml-4 text-gray-400 hover:text-gray-600 text-2xl leading-none"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <div className="p-4">
        {/* Sport Types */}
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Sport Types</h3>
          <div className="flex flex-wrap gap-2">
            {facility.sport_types
              .filter(
                (type) =>
                  ![
                    "establishment", "point_of_interest", "health",
                    "food", "restaurant", "cafe", "bar", "lodging",
                    "store", "clothing_store", "shopping_mall",
                    "amusement_park", "movie_theater", "aquarium",
                    "night_club", "tourist_attraction"
                  ].includes(type)
              )
              .map((type) => (
                <span
                  key={type}
                  className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium"
                >
                  {formatSportType(type)}
                </span>
              ))}
          </div>
        </div>

        {/* Business Status */}
        {facility.business_status && (
          <div className="mb-4">
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                facility.business_status === "OPERATIONAL"
                  ? "bg-green-100 text-green-800"
                  : "bg-red-100 text-red-800"
              }`}
            >
              {facility.business_status.replace("_", " ")}
            </span>
          </div>
        )}

        {/* Photos */}
        {facility.photo_references && facility.photo_references.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Photos</h3>
            <div className="grid grid-cols-2 gap-2">
              {facility.photo_references.slice(0, 6).map((photoRef, idx) => (
                <img
                  key={idx}
                  src={getPhotoUrl(photoRef)}
                  alt={`${facility.name} photo ${idx + 1}`}
                  className="w-full h-32 object-cover rounded-lg"
                />
              ))}
            </div>
          </div>
        )}

        {/* Contact Information */}
        <div className="mb-6 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">Contact Information</h3>

          <div className="flex items-start gap-2">
            <span className="text-gray-500">📍</span>
            <p className="text-gray-700">{facility.address}</p>
          </div>

          {facility.phone && (
            <div className="flex items-center gap-2">
              <span className="text-gray-500">📞</span>
              <a
                href={`tel:${facility.phone}`}
                className="text-blue-600 hover:underline"
              >
                {facility.phone}
              </a>
            </div>
          )}

          {facility.website && (
            <div className="flex items-center gap-2">
              <span className="text-gray-500">🌐</span>
              <a
                href={facility.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline truncate"
              >
                {facility.website.replace(/^https?:\/\//, "")}
              </a>
            </div>
          )}
        </div>

        {/* Opening Hours */}
        {facility.opening_hours && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              Hours
              {facility.opening_hours.open_now !== undefined && (
                <span
                  className={`ml-2 px-2 py-1 rounded text-xs ${
                    facility.opening_hours.open_now
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {facility.opening_hours.open_now ? "Open Now" : "Closed"}
                </span>
              )}
            </h3>
            {facility.opening_hours.weekday_text && (
              <ul className="space-y-1 text-sm text-gray-700">
                {facility.opening_hours.weekday_text.map((day, idx) => (
                  <li key={idx}>{day}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Reviews */}
        {facility.reviews && facility.reviews.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Reviews ({facility.reviews.length})
            </h3>
            <div className="space-y-4">
              {facility.reviews.map((review, idx) => (
                <div key={idx} className="border-b border-gray-200 pb-4 last:border-0">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-900">
                      {review.author_name}
                    </span>
                    <div className="flex items-center gap-1">
                      <div className="flex text-sm">{renderStars(review.rating)}</div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-1">{review.text}</p>
                  <span className="text-xs text-gray-400">
                    {review.relative_time_description}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
