import React, { useState, useEffect, useCallback } from 'react';
import { Map, Marker } from 'pigeon-maps';
import './App.css';

// ============================================================
// All 263 official NYC TLC Zone centroids
// ============================================================
const ZONE_CENTERS = [
  { id: 1, name: "Newark Airport", lat: 40.6902, lng: -74.1743 },
  { id: 2, name: "Jamaica Bay", lat: 40.6122, lng: -73.8176 },
  { id: 3, name: "Allerton/Pelham Gardens", lat: 40.8643, lng: -73.8465 },
  { id: 4, name: "Alphabet City", lat: 40.7239, lng: -73.9752 },
  { id: 5, name: "Arden Heights", lat: 40.5567, lng: -74.1898 },
  { id: 6, name: "Arrochar/Fort Wadsworth", lat: 40.6011, lng: -74.0717 },
  { id: 7, name: "Astoria", lat: 40.7614, lng: -73.9194 },
  { id: 8, name: "Astoria Park", lat: 40.7781, lng: -73.9234 },
  { id: 9, name: "Auburndale", lat: 40.7503, lng: -73.7902 },
  { id: 10, name: "Baisley Park", lat: 40.6779, lng: -73.7903 },
  { id: 11, name: "Bath Beach", lat: 40.6027, lng: -74.009 },
  { id: 12, name: "Battery Park", lat: 40.7021, lng: -74.0155 },
  { id: 13, name: "Battery Park City", lat: 40.7094, lng: -74.0173 },
  { id: 14, name: "Bay Ridge", lat: 40.6252, lng: -74.0292 },
  { id: 15, name: "Bay Terrace/Fort Totten", lat: 40.791, lng: -73.7786 },
  { id: 16, name: "Bayside", lat: 40.7628, lng: -73.768 },
  { id: 17, name: "Bedford", lat: 40.6924, lng: -73.9503 },
  { id: 18, name: "Bedford Park", lat: 40.8689, lng: -73.8894 },
  { id: 19, name: "Bellerose", lat: 40.7347, lng: -73.7289 },
  { id: 20, name: "Belmont", lat: 40.8589, lng: -73.8854 },
  { id: 21, name: "Bensonhurst East", lat: 40.6041, lng: -73.9945 },
  { id: 22, name: "Bensonhurst West", lat: 40.6119, lng: -74.001 },
  { id: 23, name: "Bloomfield/Emerson Hill", lat: 40.6057, lng: -74.0867 },
  { id: 24, name: "Bloomingdale", lat: 40.7985, lng: -73.9695 },
  { id: 25, name: "Boerum Hill", lat: 40.6825, lng: -73.9837 },
  { id: 26, name: "Borough Park", lat: 40.632, lng: -73.9918 },
  { id: 27, name: "Breezy Point/Fort Tilden/Riis Beach", lat: 40.5566, lng: -73.8994 },
  { id: 28, name: "Briarwood/Jamaica Hills", lat: 40.7101, lng: -73.8137 },
  { id: 29, name: "Brighton Beach", lat: 40.5766, lng: -73.9617 },
  { id: 30, name: "Broad Channel", lat: 40.6054, lng: -73.8181 },
  { id: 31, name: "Bronx Park", lat: 40.8572, lng: -73.8702 },
  { id: 32, name: "Bronxdale", lat: 40.8506, lng: -73.8571 },
  { id: 33, name: "Brooklyn Heights", lat: 40.694, lng: -73.9919 },
  { id: 34, name: "Brooklyn Navy Yard", lat: 40.7016, lng: -73.9688 },
  { id: 35, name: "Brownsville", lat: 40.6616, lng: -73.9183 },
  { id: 36, name: "Bushwick North", lat: 40.6982, lng: -73.9275 },
  { id: 37, name: "Bushwick South", lat: 40.6909, lng: -73.9107 },
  { id: 38, name: "Cambria Heights", lat: 40.6906, lng: -73.7378 },
  { id: 39, name: "Canarsie", lat: 40.6418, lng: -73.8957 },
  { id: 40, name: "Carroll Gardens", lat: 40.6787, lng: -73.9944 },
  { id: 41, name: "Central Harlem", lat: 40.8122, lng: -73.9463 },
  { id: 42, name: "Central Harlem North", lat: 40.8178, lng: -73.9403 },
  { id: 43, name: "Central Park", lat: 40.7829, lng: -73.9654 },
  { id: 44, name: "Charleston/Tottenville", lat: 40.5119, lng: -74.2329 },
  { id: 45, name: "Chinatown", lat: 40.716, lng: -73.9986 },
  { id: 46, name: "City Island", lat: 40.8455, lng: -73.7864 },
  { id: 47, name: "Claremont/Bathgate", lat: 40.8418, lng: -73.9003 },
  { id: 48, name: "Clinton East", lat: 40.763, lng: -73.9908 },
  { id: 49, name: "Clinton Hill", lat: 40.6888, lng: -73.9649 },
  { id: 50, name: "Clinton West", lat: 40.7627, lng: -73.9944 },
  { id: 51, name: "Co-Op City", lat: 40.873, lng: -73.8267 },
  { id: 52, name: "Cobble Hill", lat: 40.6854, lng: -73.9918 },
  { id: 53, name: "College Point", lat: 40.7849, lng: -73.8444 },
  { id: 54, name: "Columbia Street", lat: 40.6758, lng: -74.0037 },
  { id: 55, name: "Coney Island", lat: 40.5723, lng: -73.979 },
  { id: 56, name: "Corona", lat: 40.7402, lng: -73.8621 },
  { id: 57, name: "Corona", lat: 40.7557, lng: -73.8535 },
  { id: 58, name: "Country Club", lat: 40.838, lng: -73.8153 },
  { id: 59, name: "Crotona Park", lat: 40.8409, lng: -73.8935 },
  { id: 60, name: "Crotona Park East", lat: 40.8371, lng: -73.8909 },
  { id: 61, name: "Crown Heights North", lat: 40.6742, lng: -73.9467 },
  { id: 62, name: "Crown Heights South", lat: 40.6636, lng: -73.9484 },
  { id: 63, name: "Cypress Hills", lat: 40.6829, lng: -73.8715 },
  { id: 64, name: "Douglaston", lat: 40.7626, lng: -73.7419 },
  { id: 65, name: "Downtown Brooklyn/MetroTech", lat: 40.6897, lng: -73.9849 },
  { id: 66, name: "DUMBO/Vinegar Hill", lat: 40.7025, lng: -73.9816 },
  { id: 67, name: "Dyker Heights", lat: 40.621, lng: -74.0063 },
  { id: 68, name: "East Chelsea", lat: 40.7445, lng: -73.9893 },
  { id: 69, name: "East Concourse/Concourse Village", lat: 40.8255, lng: -73.9144 },
  { id: 70, name: "East Elmhurst", lat: 40.7684, lng: -73.8682 },
  { id: 71, name: "East Flatbush/Farragut", lat: 40.6441, lng: -73.9462 },
  { id: 72, name: "East Flatbush/Remsen Village", lat: 40.6497, lng: -73.9306 },
  { id: 73, name: "East Flushing", lat: 40.7528, lng: -73.8069 },
  { id: 74, name: "East Harlem North", lat: 40.7995, lng: -73.9365 },
  { id: 75, name: "East Harlem South", lat: 40.7908, lng: -73.9422 },
  { id: 76, name: "East New York", lat: 40.6605, lng: -73.8759 },
  { id: 77, name: "East New York/Pennsylvania Ave", lat: 40.6604, lng: -73.8872 },
  { id: 78, name: "East Tremont", lat: 40.8436, lng: -73.8817 },
  { id: 79, name: "East Village", lat: 40.7264, lng: -73.9829 },
  { id: 80, name: "East Williamsburg", lat: 40.714, lng: -73.9325 },
  { id: 81, name: "Eastchester", lat: 40.887, lng: -73.8328 },
  { id: 82, name: "Elmhurst", lat: 40.7355, lng: -73.877 },
  { id: 83, name: "Elmhurst/Maspeth", lat: 40.7302, lng: -73.8892 },
  { id: 84, name: "Eltingville/Annadale/Prince's Bay", lat: 40.5427, lng: -74.1693 },
  { id: 85, name: "Erasmus", lat: 40.6508, lng: -73.9569 },
  { id: 86, name: "Far Rockaway", lat: 40.5965, lng: -73.7515 },
  { id: 87, name: "Financial District North", lat: 40.7084, lng: -74.008 },
  { id: 88, name: "Financial District South", lat: 40.7045, lng: -74.0095 },
  { id: 89, name: "Flatbush/Ditmas Park", lat: 40.6367, lng: -73.961 },
  { id: 90, name: "Flatiron", lat: 40.7403, lng: -73.9889 },
  { id: 91, name: "Flatlands", lat: 40.626, lng: -73.9225 },
  { id: 92, name: "Flushing", lat: 40.7585, lng: -73.8295 },
  { id: 93, name: "Flushing Meadows-Corona Park", lat: 40.7399, lng: -73.8403 },
  { id: 94, name: "Fordham South", lat: 40.8572, lng: -73.8969 },
  { id: 95, name: "Forest Hills", lat: 40.7135, lng: -73.8448 },
  { id: 96, name: "Forest Park/Highland Park", lat: 40.6917, lng: -73.8643 },
  { id: 97, name: "Fort Greene", lat: 40.6888, lng: -73.9749 },
  { id: 98, name: "Fresh Meadows", lat: 40.7339, lng: -73.7784 },
  { id: 99, name: "Freshkills Park", lat: 40.5826, lng: -74.1828 },
  { id: 100, name: "Garment District", lat: 40.7539, lng: -73.9876 },
  { id: 101, name: "Glen Oaks", lat: 40.7462, lng: -73.7087 },
  { id: 102, name: "Glendale", lat: 40.7003, lng: -73.881 },
  { id: 103, name: "Governor's Island/Ellis Island/Liberty Island", lat: 40.6911, lng: -74.0234 },
  { id: 104, name: "Governor's Island/Ellis Island/Liberty Island", lat: 40.6914, lng: -74.0399 },
  { id: 105, name: "Governor's Island/Ellis Island/Liberty Island", lat: 40.6906, lng: -74.0505 },
  { id: 106, name: "Gowanus", lat: 40.6713, lng: -73.9898 },
  { id: 107, name: "Gramercy", lat: 40.7379, lng: -73.9826 },
  { id: 108, name: "Gravesend", lat: 40.5955, lng: -73.9741 },
  { id: 109, name: "Great Kills", lat: 40.553, lng: -74.1414 },
  { id: 110, name: "Great Kills Park", lat: 40.5522, lng: -74.1133 },
  { id: 111, name: "Green-Wood Cemetery", lat: 40.6521, lng: -73.99 },
  { id: 112, name: "Greenpoint", lat: 40.7283, lng: -73.9494 },
  { id: 113, name: "Greenwich Village North", lat: 40.735, lng: -73.9983 },
  { id: 114, name: "Greenwich Village South", lat: 40.7295, lng: -74.0001 },
  { id: 115, name: "Grymes Hill/Clifton", lat: 40.6188, lng: -74.0823 },
  { id: 116, name: "Hamilton Heights", lat: 40.826, lng: -73.949 },
  { id: 117, name: "Hammels/Arverne", lat: 40.589, lng: -73.8064 },
  { id: 118, name: "Heartland Village/Todt Hill", lat: 40.5992, lng: -74.1114 },
  { id: 119, name: "Highbridge", lat: 40.8389, lng: -73.9267 },
  { id: 120, name: "Highbridge Park", lat: 40.8508, lng: -73.9313 },
  { id: 121, name: "Hillcrest/Pomonok", lat: 40.7264, lng: -73.8102 },
  { id: 122, name: "Hollis", lat: 40.7109, lng: -73.764 },
  { id: 123, name: "Homecrest", lat: 40.601, lng: -73.9567 },
  { id: 124, name: "Howard Beach", lat: 40.654, lng: -73.8338 },
  { id: 125, name: "Hudson Sq", lat: 40.7264, lng: -74.0079 },
  { id: 126, name: "Hunts Point", lat: 40.8121, lng: -73.8777 },
  { id: 127, name: "Inwood", lat: 40.8667, lng: -73.9226 },
  { id: 128, name: "Inwood Hill Park", lat: 40.8724, lng: -73.9276 },
  { id: 129, name: "Jackson Heights", lat: 40.7444, lng: -73.8834 },
  { id: 130, name: "Jamaica", lat: 40.7027, lng: -73.7948 },
  { id: 131, name: "Jamaica Estates", lat: 40.7169, lng: -73.7808 },
  { id: 132, name: "JFK Airport", lat: 40.6501, lng: -73.7805 },
  { id: 133, name: "Kensington", lat: 40.6401, lng: -73.9732 },
  { id: 134, name: "Kew Gardens", lat: 40.7072, lng: -73.8274 },
  { id: 135, name: "Kew Gardens Hills", lat: 40.7239, lng: -73.8178 },
  { id: 136, name: "Kingsbridge Heights", lat: 40.8687, lng: -73.8984 },
  { id: 137, name: "Kips Bay", lat: 40.7437, lng: -73.9781 },
  { id: 138, name: "LaGuardia Airport", lat: 40.7746, lng: -73.8709 },
  { id: 139, name: "Laurelton", lat: 40.6766, lng: -73.7503 },
  { id: 140, name: "Lenox Hill East", lat: 40.766, lng: -73.9606 },
  { id: 141, name: "Lenox Hill West", lat: 40.7678, lng: -73.9665 },
  { id: 142, name: "Lincoln Square East", lat: 40.7731, lng: -73.98 },
  { id: 143, name: "Lincoln Square West", lat: 40.7744, lng: -73.9852 },
  { id: 144, name: "Little Italy/NoLiTa", lat: 40.7193, lng: -73.9954 },
  { id: 145, name: "Long Island City/Hunters Point", lat: 40.7384, lng: -73.9525 },
  { id: 146, name: "Long Island City/Queens Plaza", lat: 40.7483, lng: -73.9351 },
  { id: 147, name: "Longwood", lat: 40.8219, lng: -73.8941 },
  { id: 148, name: "Lower East Side", lat: 40.7135, lng: -73.9811 },
  { id: 149, name: "Madison", lat: 40.6056, lng: -73.9464 },
  { id: 150, name: "Manhattan Beach", lat: 40.5812, lng: -73.9412 },
  { id: 151, name: "Manhattan Valley", lat: 40.7994, lng: -73.971 },
  { id: 152, name: "Manhattanville", lat: 40.8196, lng: -73.9561 },
  { id: 153, name: "Marble Hill", lat: 40.8746, lng: -73.9118 },
  { id: 154, name: "Marine Park/Floyd Bennett Field", lat: 40.5946, lng: -73.9147 },
  { id: 155, name: "Marine Park/Mill Basin", lat: 40.6132, lng: -73.902 },
  { id: 156, name: "Mariners Harbor", lat: 40.6408, lng: -74.1739 },
  { id: 157, name: "Maspeth", lat: 40.7235, lng: -73.9039 },
  { id: 158, name: "Meatpacking/West Village West", lat: 40.7369, lng: -74.0105 },
  { id: 159, name: "Melrose South", lat: 40.8199, lng: -73.9135 },
  { id: 160, name: "Middle Village", lat: 40.7193, lng: -73.883 },
  { id: 161, name: "Midtown Center", lat: 40.7578, lng: -73.9773 },
  { id: 162, name: "Midtown East", lat: 40.7565, lng: -73.9726 },
  { id: 163, name: "Midtown North", lat: 40.7656, lng: -73.9788 },
  { id: 164, name: "Midtown South", lat: 40.7485, lng: -73.9847 },
  { id: 165, name: "Midwood", lat: 40.6217, lng: -73.9582 },
  { id: 166, name: "Morningside Heights", lat: 40.8107, lng: -73.9636 },
  { id: 167, name: "Morrisania/Melrose", lat: 40.8257, lng: -73.905 },
  { id: 168, name: "Mott Haven/Port Morris", lat: 40.8043, lng: -73.9121 },
  { id: 169, name: "Mount Hope", lat: 40.8481, lng: -73.9064 },
  { id: 170, name: "Murray Hill", lat: 40.7475, lng: -73.9783 },
  { id: 171, name: "Murray Hill-Queens", lat: 40.7681, lng: -73.8076 },
  { id: 172, name: "New Dorp/Midland Beach", lat: 40.5689, lng: -74.1046 },
  { id: 173, name: "North Corona", lat: 40.7542, lng: -73.8615 },
  { id: 174, name: "Norwood", lat: 40.8787, lng: -73.882 },
  { id: 175, name: "Oakland Gardens", lat: 40.7436, lng: -73.7553 },
  { id: 176, name: "Oakwood", lat: 40.5646, lng: -74.1214 },
  { id: 177, name: "Ocean Hill", lat: 40.6771, lng: -73.912 },
  { id: 178, name: "Ocean Parkway South", lat: 40.6178, lng: -73.9715 },
  { id: 179, name: "Old Astoria", lat: 40.7724, lng: -73.9301 },
  { id: 180, name: "Ozone Park", lat: 40.6763, lng: -73.8485 },
  { id: 181, name: "Park Slope", lat: 40.6707, lng: -73.9807 },
  { id: 182, name: "Parkchester", lat: 40.8371, lng: -73.8586 },
  { id: 183, name: "Pelham Bay", lat: 40.8494, lng: -73.8311 },
  { id: 184, name: "Pelham Bay Park", lat: 40.8622, lng: -73.7965 },
  { id: 185, name: "Pelham Parkway", lat: 40.8544, lng: -73.853 },
  { id: 186, name: "Penn Station/Madison Sq West", lat: 40.7486, lng: -73.992 },
  { id: 187, name: "Port Richmond", lat: 40.6327, lng: -74.1361 },
  { id: 188, name: "Prospect-Lefferts Gardens", lat: 40.6587, lng: -73.9481 },
  { id: 189, name: "Prospect Heights", lat: 40.6767, lng: -73.9681 },
  { id: 190, name: "Prospect Park", lat: 40.6611, lng: -73.9726 },
  { id: 191, name: "Queens Village", lat: 40.7169, lng: -73.7424 },
  { id: 192, name: "Queensboro Hill", lat: 40.7441, lng: -73.8147 },
  { id: 193, name: "Queensbridge/Ravenswood", lat: 40.7627, lng: -73.9391 },
  { id: 194, name: "Randalls Island", lat: 40.7918, lng: -73.9257 },
  { id: 195, name: "Red Hook", lat: 40.6744, lng: -74.013 },
  { id: 196, name: "Rego Park", lat: 40.7262, lng: -73.864 },
  { id: 197, name: "Richmond Hill", lat: 40.6955, lng: -73.8291 },
  { id: 198, name: "Ridgewood", lat: 40.7074, lng: -73.9042 },
  { id: 199, name: "Rikers Island", lat: 40.7935, lng: -73.8807 },
  { id: 200, name: "Riverdale/North Riverdale/Fieldston", lat: 40.8989, lng: -73.9082 },
  { id: 201, name: "Rockaway Park", lat: 40.5788, lng: -73.8382 },
  { id: 202, name: "Roosevelt Island", lat: 40.7618, lng: -73.9502 },
  { id: 203, name: "Rosedale", lat: 40.6441, lng: -73.7449 },
  { id: 204, name: "Rossville/Woodrow", lat: 40.5399, lng: -74.2088 },
  { id: 205, name: "Saint Albans", lat: 40.6929, lng: -73.7643 },
  { id: 206, name: "Saint George/New Brighton", lat: 40.6406, lng: -74.0999 },
  { id: 207, name: "Saint Michaels Cemetery/Woodside", lat: 40.7638, lng: -73.8977 },
  { id: 208, name: "Schuylerville/Edgewater Park", lat: 40.8202, lng: -73.8149 },
  { id: 209, name: "Seaport", lat: 40.7083, lng: -74.0023 },
  { id: 210, name: "Sheepshead Bay", lat: 40.59, lng: -73.9301 },
  { id: 211, name: "SoHo", lat: 40.7235, lng: -74.0022 },
  { id: 212, name: "Soundview/Bruckner", lat: 40.828, lng: -73.8682 },
  { id: 213, name: "Soundview/Castle Hill", lat: 40.8154, lng: -73.8504 },
  { id: 214, name: "South Beach/Dongan Hills", lat: 40.5839, lng: -74.0793 },
  { id: 215, name: "South Jamaica", lat: 40.6947, lng: -73.7921 },
  { id: 216, name: "South Ozone Park", lat: 40.6765, lng: -73.8171 },
  { id: 217, name: "South Williamsburg", lat: 40.7041, lng: -73.958 },
  { id: 218, name: "Springfield Gardens North", lat: 40.6729, lng: -73.7728 },
  { id: 219, name: "Springfield Gardens South", lat: 40.662, lng: -73.7704 },
  { id: 220, name: "Spuyten Duyvil/Kingsbridge", lat: 40.8823, lng: -73.912 },
  { id: 221, name: "Stapleton", lat: 40.6205, lng: -74.0722 },
  { id: 222, name: "Starrett City", lat: 40.6448, lng: -73.8841 },
  { id: 223, name: "Steinway", lat: 40.7821, lng: -73.8957 },
  { id: 224, name: "Stuy Town/Peter Cooper Village", lat: 40.7316, lng: -73.9743 },
  { id: 225, name: "Stuyvesant Heights", lat: 40.6887, lng: -73.9305 },
  { id: 226, name: "Sunnyside", lat: 40.727, lng: -73.9258 },
  { id: 227, name: "Sunset Park East", lat: 40.6398, lng: -74.0069 },
  { id: 228, name: "Sunset Park West", lat: 40.6555, lng: -74.0119 },
  { id: 229, name: "Sutton Place/Turtle Bay North", lat: 40.7558, lng: -73.9643 },
  { id: 230, name: "Times Sq/Theatre District", lat: 40.7596, lng: -73.9843 },
  { id: 231, name: "TriBeCa/Civic Center", lat: 40.7188, lng: -74.0099 },
  { id: 232, name: "Two Bridges/Seward Park", lat: 40.7136, lng: -73.983 },
  { id: 233, name: "UN/Turtle Bay South", lat: 40.7463, lng: -73.9696 },
  { id: 234, name: "Union Sq", lat: 40.7393, lng: -73.9901 },
  { id: 235, name: "University Heights/Morris Heights", lat: 40.8541, lng: -73.9172 },
  { id: 236, name: "Upper East Side North", lat: 40.7803, lng: -73.9571 },
  { id: 237, name: "Upper East Side South", lat: 40.7685, lng: -73.9657 },
  { id: 238, name: "Upper West Side North", lat: 40.7924, lng: -73.9741 },
  { id: 239, name: "Upper West Side South", lat: 40.7848, lng: -73.9832 },
  { id: 240, name: "Van Cortlandt Park", lat: 40.8908, lng: -73.8791 },
  { id: 241, name: "Van Cortlandt Village", lat: 40.8753, lng: -73.896 },
  { id: 242, name: "Van Nest/Morris Park", lat: 40.8485, lng: -73.8492 },
  { id: 243, name: "Washington Heights North", lat: 40.8574, lng: -73.9375 },
  { id: 244, name: "Washington Heights South", lat: 40.8428, lng: -73.9433 },
  { id: 245, name: "West Brighton", lat: 40.6323, lng: -74.1038 },
  { id: 246, name: "West Chelsea/Hudson Yards", lat: 40.7501, lng: -74.0081 },
  { id: 247, name: "West Concourse", lat: 40.8302, lng: -73.9241 },
  { id: 248, name: "West Farms/Bronx River", lat: 40.8349, lng: -73.8737 },
  { id: 249, name: "West Village", lat: 40.7338, lng: -74.0031 },
  { id: 250, name: "Westchester Village/Unionport", lat: 40.8343, lng: -73.845 },
  { id: 251, name: "Westerleigh", lat: 40.6165, lng: -74.1261 },
  { id: 252, name: "Whitestone", lat: 40.7951, lng: -73.815 },
  { id: 253, name: "Willets Point", lat: 40.762, lng: -73.8422 },
  { id: 254, name: "Williamsbridge/Olinville", lat: 40.8824, lng: -73.8591 },
  { id: 255, name: "Williamsburg (North Side)", lat: 40.7197, lng: -73.9617 },
  { id: 256, name: "Williamsburg (South Side)", lat: 40.7107, lng: -73.9629 },
  { id: 257, name: "Windsor Terrace", lat: 40.656, lng: -73.9784 },
  { id: 258, name: "Woodhaven", lat: 40.6876, lng: -73.8547 },
  { id: 259, name: "Woodlawn/Wakefield", lat: 40.9001, lng: -73.8536 },
  { id: 260, name: "Woodside", lat: 40.7464, lng: -73.9059 },
  { id: 261, name: "World Trade Center", lat: 40.7075, lng: -74.014 },
  { id: 262, name: "Yorkville East", lat: 40.7784, lng: -73.9435 },
  { id: 263, name: "Yorkville West", lat: 40.779, lng: -73.9502 },
];

// ============================================================
// Utility: Haversine distance (miles) with NYC grid multiplier
// ============================================================
const getDistanceMiles = (lat1, lon1, lat2, lon2) => {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c * 1.4; // 1.4× multiplier approximates NYC street grid
};

// ============================================================
// Nearest-Neighbor lookup: map click coordinates → TLC Zone ID
// ============================================================
const findNearestZone = (lat, lng) => {
  let nearest = ZONE_CENTERS[0];
  let minDist = Infinity;
  for (const zone of ZONE_CENTERS) {
    const d = getDistanceMiles(lat, lng, zone.lat, zone.lng);
    if (d < minDist) {
      minDist = d;
      nearest = zone;
    }
  }
  return nearest;
};

// ============================================================
// App Component
// ============================================================
function App() {
  const [fare, setFare] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Map click state
  const [puCoords, setPuCoords] = useState(null);
  const [doCoords, setDoCoords] = useState(null);

  // Resolved zone names
  const [puZone, setPuZone] = useState(null);
  const [doZone, setDoZone] = useState(null);

  // Background context data (weather + time)
  const [weather, setWeather] = useState({ temp: 65, precip: 0, snow: 0, wind: 5 });
  const [timeData, setTimeData] = useState({ hour: new Date().getHours(), isWeekend: 0 });

  // Fetch live weather on mount
  useEffect(() => {
    const fetchContext = async () => {
      try {
        const res = await fetch(
          'https://api.open-meteo.com/v1/forecast?latitude=40.7128&longitude=-74.0060&current=temperature_2m,precipitation,wind_speed_10m&temperature_unit=fahrenheit&wind_speed_unit=mph'
        );
        const data = await res.json();
        setWeather({
          temp: data.current.temperature_2m,
          precip: data.current.precipitation,
          snow: 0,
          wind: data.current.wind_speed_10m,
        });
      } catch {
        console.warn('Weather API unavailable — using defaults.');
      }

      // 🕒 STRICT NYC TIME ENFORCEMENT FOR THE UI
      const nycTimeString = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
      const nycDate = new Date(nycTimeString);

      setTimeData({
        hour: nycDate.getHours(),
        isWeekend: (nycDate.getDay() === 0 || nycDate.getDay() === 6) ? 1 : 0,
      });
    };
    fetchContext();
  }, []);

  // Map click handler: click 1 = pickup, click 2 = dropoff, click 3 = reset
  const handleMapClick = useCallback(
    ({ latLng }) => {
      const nearest = findNearestZone(latLng[0], latLng[1]);
      const distFromZone = getDistanceMiles(latLng[0], latLng[1], nearest.lat, nearest.lng);
      
      if (distFromZone > 5) {
        setError('📍 This location is outside the NYC Taxi service area.');
        return;
      }

      if (!puCoords) {
        setPuCoords(latLng);
        setPuZone(nearest);
        setFare(null);
        setError(null);
      } else if (!doCoords) {
        setDoCoords(latLng);
        setDoZone(nearest);
      } else {
        setPuCoords(latLng);
        setPuZone(nearest);
        setDoCoords(null);
        setDoZone(null);
        setFare(null);
        setError(null);
      }
    },
    [puCoords, doCoords]
  );

  const handleReset = () => {
    setPuCoords(null);
    setDoCoords(null);
    setPuZone(null);
    setDoZone(null);
    setFare(null);
    setError(null);
  };

  const handlePredict = async () => {
    if (!puCoords || !doCoords) {
      setError('Please click on the map to set both Pickup and Drop-off points.');
      return;
    }

    setLoading(true);
    setError(null);
    setFare(null);

    const distanceMiles = getDistanceMiles(puCoords[0], puCoords[1], doCoords[0], doCoords[1]);
    const estimatedTimeSeconds = distanceMiles * 220;

    const resolvedPU = puZone || findNearestZone(puCoords[0], puCoords[1]);
    const resolvedDO = doZone || findNearestZone(doCoords[0], doCoords[1]);

    // Streamlined Payload sent to the Node API Gateway
    const payload = {
      puLat: puCoords[0],
      puLng: puCoords[1],
      doLat: doCoords[0],
      doLng: doCoords[1],
      PULocationID: resolvedPU.id,
      DOLocationID: resolvedDO.id,
      trip_miles: distanceMiles,
      trip_time: estimatedTimeSeconds,
      temp: weather.temp,
      precip: weather.precip,
      snow: weather.snow
    };

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';
      const response = await fetch(`${apiUrl}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Server error');

      setFare({ ...data, distance: distanceMiles, puName: resolvedPU.name, doName: resolvedDO.name });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getInstruction = () => {
    if (!puCoords) return '🟢  Click the map to set your Pickup location';
    if (!doCoords) return '🔴  Now click to set your Drop-off location';
    return '✅  Both points set — click "Predict Fare" or click the map to reset';
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="logo-mark">🚕</div>
        <h1>NYC Taxi Fare Predictor</h1>
        <p className="subtitle">
          ML-powered fare estimation using live traffic &amp; weather data
        </p>
      </header>

      <main className="app-main">
        <div className="instruction-banner">{getInstruction()}</div>

        <div className="map-container" id="map-container">
          <Map
            height={420}
            defaultCenter={[40.73, -73.98]}
            defaultZoom={11}
            onClick={handleMapClick}
            attribution={false}
          >
            {puCoords && <Marker width={44} anchor={puCoords} color="#3b82f6" />}
            {doCoords && <Marker width={44} anchor={doCoords} color="#10b981" />}
          </Map>
        </div>

        <div className="location-cards">
          <div className={`loc-card pickup ${puCoords ? 'active' : ''}`} id="pickup-card">
            <span className="loc-dot pickup-dot" />
            <div className="loc-info">
              <span className="loc-label">Pickup</span>
              <span className="loc-value">
                {puZone ? puZone.name : 'Click map to set'}
              </span>
            </div>
          </div>
          <div className="route-arrow">→</div>
          <div className={`loc-card dropoff ${doCoords ? 'active' : ''}`} id="dropoff-card">
            <span className="loc-dot dropoff-dot" />
            <div className="loc-info">
              <span className="loc-label">Drop-off</span>
              <span className="loc-value">
                {doZone ? doZone.name : 'Click map to set'}
              </span>
            </div>
          </div>
        </div>

        <div className="context-pills">
          <span className="pill">🌡️ {weather.temp.toFixed(0)}°F</span>
          <span className="pill">💧 {weather.precip.toFixed(1)} mm</span>
          <span className="pill">🕐 {timeData.hour}:00</span>
          <span className="pill">{timeData.isWeekend ? '📅 Weekend' : '📅 Weekday'}</span>
        </div>

        <div className="action-row">
          <button
            onClick={handlePredict}
            className="predict-btn"
            disabled={loading || !puCoords || !doCoords}
            id="predict-button"
          >
            {loading ? (
              <span className="btn-loading">
                <span className="spinner" /> Calculating Route...
              </span>
            ) : (
              '🚖  Predict Fare'
            )}
          </button>
          {(puCoords || doCoords) && (
            <button onClick={handleReset} className="reset-btn" id="reset-button">
              ↺ Reset
            </button>
          )}
        </div>

        {error && (
          <div className="error-card" id="error-display">
            <span className="error-icon">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {fare && (
          <div className="results-card" id="results-card">
            
            {/* We calculate the tip dynamically on the frontend */}
            <div className="results-header">
              <span className="results-label">Estimated Total (w/ 20% Tip)</span>
              <span className="results-fare">
                ${(fare.predicted_fare + (fare.predicted_fare * 0.20)).toFixed(2)}
              </span>
            </div>
            
            <div className="results-route">
              {fare.puName} → {fare.doName}
            </div>
            
            <div className="results-divider" />
            
            <div className="results-breakdown">
              <div className="breakdown-item">
                <span className="breakdown-label">ML Base Prediction</span>
                <span className="breakdown-value">${fare.breakdown.base_prediction.toFixed(2)}</span>
              </div>
              
              <div className="results-divider" style={{ borderStyle: "dashed", margin: "10px 0" }} />
              <div style={{ fontSize: "0.85em", color: "#666", marginBottom: "8px", fontWeight: "bold" }}>Official TLC Surcharges</div>

              <div className="breakdown-item">
                <span className="breakdown-label">MTA & Improvement Fees</span>
                <span className="breakdown-value">${fare.breakdown.surcharges.mta_and_improvement.toFixed(2)}</span>
              </div>

              {fare.breakdown.surcharges.time_surcharges > 0 && (
                <div className="breakdown-item">
                  <span className="breakdown-label">Time Surcharge (Rush Hour/Overnight)</span>
                  <span className="breakdown-value">${fare.breakdown.surcharges.time_surcharges.toFixed(2)}</span>
                </div>
              )}

              {fare.breakdown.surcharges.congestion_tolls > 0 && (
                <div className="breakdown-item">
                  <span className="breakdown-label">NYS & MTA Congestion Tolls</span>
                  <span className="breakdown-value">${fare.breakdown.surcharges.congestion_tolls.toFixed(2)}</span>
                </div>
              )}

              {fare.breakdown.surcharges.airport_fees > 0 && (
                <div className="breakdown-item">
                  <span className="breakdown-label">Airport Access/Area Fees</span>
                  <span className="breakdown-value">${fare.breakdown.surcharges.airport_fees.toFixed(2)}</span>
                </div>
              )}

              <div className="results-divider" style={{ borderStyle: "solid", margin: "10px 0" }} />

              <div className="breakdown-item" style={{ fontWeight: "bold" }}>
                <span className="breakdown-label">Total Meter Fare</span>
                <span className="breakdown-value">${fare.predicted_fare.toFixed(2)}</span>
              </div>
              
              <div className="breakdown-item" style={{ color: "#2e7d32", fontWeight: "bold" }}>
                <span className="breakdown-label">Recommended Tip (20%)</span>
                <span className="breakdown-value">+ ${(fare.predicted_fare * 0.20).toFixed(2)}</span>
              </div>
            </div>

            {/* Disclaimer for the missing tolls */}
            <div className="helpful-context" style={{ marginTop: "15px", fontSize: "0.8em", color: "#888", textAlign: "center" }}>
              <em>* Note: Final price excludes physical bridge/tunnel tolls.</em>
            </div>

          </div>
        )}
      </main>

      <footer className="app-footer">
        <p>
          Powered by XGBoost · NYC TLC 2024 Data · Live Weather via Open-Meteo
        </p>
      </footer>
    </div>
  );
}

export default App;