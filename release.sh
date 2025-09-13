#!/bin/bash

# LegalTechOps PCF Components Build Script
# Created by Maximilian Henkensiefken
# This script builds all PCF components and creates solution packages

# Set stricter error handling, but allow some commands to fail gracefully
set -e  # Exit on any error
set -o pipefail  # Catch errors in pipes

echo "🚀 LegalTechOps PCF Components Build Script"
echo "==========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the correct directory
if [ ! -f "LegalTechOpsCustomComponents.cdsproj" ]; then
    print_error "This script must be run from the root directory containing LegalTechOpsCustomComponents.cdsproj"
    exit 1
fi

# Function to increment version in manifest files
increment_version() {
    local file_path="$1"
    local version_part="$2"
    
    if [ ! -f "$file_path" ]; then
        print_warning "Manifest file not found: $file_path"
        return 1
    fi
    
    # Extract current version
    current_version=$(grep -o 'Version="[^"]*"' "$file_path" | sed 's/Version="//g' | sed 's/"//g')
    
    if [ -z "$current_version" ]; then
        print_warning "Could not extract version from $file_path"
        return 1
    fi
    
    print_status "Current version in $file_path: $current_version"
    
    # Split version into components
    IFS='.' read -ra VERSION_PARTS <<< "$current_version"
    major=${VERSION_PARTS[0]:-1}
    minor=${VERSION_PARTS[1]:-0}
    build=${VERSION_PARTS[2]:-0}
    revision=${VERSION_PARTS[3]:-0}
    
    # Increment the specified part
    case $version_part in
        "major")
            major=$((major + 1))
            minor=0
            build=0
            revision=0
            ;;
        "minor")
            minor=$((minor + 1))
            build=0
            revision=0
            ;;
        "build")
            build=$((build + 1))
            revision=0
            ;;
        "revision")
            revision=$((revision + 1))
            ;;
    esac
    
    new_version="$major.$minor.$build.$revision"
    print_status "New version: $new_version"
    
    # Update the version in the file
    sed -i.bak "s/Version=\"[^\"]*\"/Version=\"$new_version\"/g" "$file_path"
    
    if [ $? -eq 0 ]; then
        rm -f "${file_path}.bak"
        print_success "Updated version in $file_path to $new_version"
        echo "$new_version"
    else
        print_error "Failed to update version in $file_path"
        return 1
    fi
}

# Prompt user for version update level
echo
echo "Which version level do you want to increment?"
echo "1) Major"
echo "2) Minor"
echo "3) Build"
echo "4) Revision"
read -p "Enter choice [1-4]: " VERSION_LEVEL

case $VERSION_LEVEL in
    1) VERSION_PART="major" ;;
    2) VERSION_PART="minor" ;;
    3) VERSION_PART="build" ;;
    4) VERSION_PART="revision" ;;
    *) 
        print_error "Invalid choice. Exiting."
        exit 1
        ;;
esac

print_status "🏗️ Building PCF Components..."

# Find all PCF components in the src directory
PCF_COMPONENTS=()
if [ -d "src" ]; then
    for dir in src/*/; do
        component_name=$(basename "$dir")
        
        # Skip the 'Other' directory which contains solution metadata
        if [ "$component_name" = "Other" ]; then
            continue
        fi
        
        # Check for package.json and either *.pcfproj in the root or subdirectory
        if [ -f "${dir}package.json" ]; then
            # Look for .pcfproj file in the component directory or subdirectory
            if [ -f "${dir}${component_name}.pcfproj" ] || [ -f "${dir}${component_name}/${component_name}.pcfproj" ] || find "${dir}" -name "*.pcfproj" -type f | head -1 | grep -q .; then
                PCF_COMPONENTS+=("$component_name")
                print_status "Found PCF component: $component_name"
            fi
        fi
    done
fi

if [ ${#PCF_COMPONENTS[@]} -eq 0 ]; then
    print_warning "⚠️ No PCF components found in src/ directory"
fi

# Build each PCF component
for component in "${PCF_COMPONENTS[@]}"; do
    print_status "🔨 Building component: $component"
    component_dir="src/$component"
    
    if [ -d "$component_dir" ]; then
        cd "$component_dir" || continue
        
        # Find the manifest file
        manifest_file=""
        if [ -f "${component}/${component}/ControlManifest.Input.xml" ]; then
            manifest_file="${component}/${component}/ControlManifest.Input.xml"
        elif [ -f "${component}/ControlManifest.Input.xml" ]; then
            manifest_file="${component}/ControlManifest.Input.xml"
        elif [ -f "ControlManifest.Input.xml" ]; then
            manifest_file="ControlManifest.Input.xml"
        else
            # Search for any ControlManifest.Input.xml file
            manifest_file=$(find . -name "ControlManifest.Input.xml" -type f | head -1)
        fi
        
        if [ -n "$manifest_file" ]; then
            print_status "Updating version in manifest: $manifest_file"
            new_version=$(increment_version "$manifest_file" "$VERSION_PART")
            if [ $? -eq 0 ]; then
                RELEASE_VERSION="$new_version"
            fi
        else
            print_warning "No manifest file found for $component"
        fi
        
        # Install dependencies if package.json exists
        if [ -f "package.json" ]; then
            print_status "Installing npm dependencies for $component..."
            npm install --silent 2>/dev/null || print_warning "npm install failed for $component"
        fi
        
        # Build the component
        print_status "Building $component..."
        npm run build 2>/dev/null || print_warning "Build failed for $component"
        
        cd - > /dev/null
    else
        print_warning "Component directory not found: $component_dir"
    fi
done

# Update root-level manifest files if they exist
root_manifests=("ControlManifest.Input.xml" "src/ControlManifest.Input.xml")
for manifest in "${root_manifests[@]}"; do
    if [ -f "$manifest" ]; then
        print_status "Updating root manifest: $manifest"
        new_version=$(increment_version "$manifest" "$VERSION_PART")
        if [ $? -eq 0 ] && [ -z "$RELEASE_VERSION" ]; then
            RELEASE_VERSION="$new_version"
        fi
    fi
done

# Build the main solution
print_status "🏗️ Building main solution..."
if [ -f "LegalTechOpsCustomComponents.cdsproj" ]; then
    # Clean and build the solution
    print_status "Cleaning previous build artifacts..."
    dotnet clean --configuration Release --verbosity quiet 2>/dev/null || print_warning "dotnet clean failed"
    
    print_status "Building solution..."
    dotnet build --configuration Release --verbosity quiet 2>/dev/null || print_warning "dotnet build failed"
fi

# Commit and tag the release
if [ -n "$RELEASE_VERSION" ]; then
    print_status "📦 Committing release version $RELEASE_VERSION"
    
    # Add all changes
    git add .
    
    # Create commit
    git commit -m "chore: release version $RELEASE_VERSION" || print_warning "Nothing to commit"
    
    # Create tag
    git tag -a "v$RELEASE_VERSION" -m "Release version $RELEASE_VERSION"
    
    print_success "✅ Release $RELEASE_VERSION completed successfully!"
    print_status "📋 Summary:"
    echo "  - Version: $RELEASE_VERSION"
    echo "  - Components built: ${#PCF_COMPONENTS[@]}"
    echo "  - Tag created: v$RELEASE_VERSION"
    echo ""
    print_status "To push to remote repository:"
    echo "  git push origin $(git branch --show-current)"
    echo "  git push origin v$RELEASE_VERSION"
else
    print_warning "No version was successfully updated. Please check the manifest files."
fi

print_status "🎉 Build script completed!"